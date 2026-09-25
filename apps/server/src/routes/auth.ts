import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AuthMeResponse } from '@github-bot/shared';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /auth/github
   * Initiates GitHub OAuth authorization flow
   */
  fastify.get('/auth/github', async (_request, reply) => {
    // Generate secure random state token to prevent CSRF
    const state = crypto.randomBytes(24).toString('hex');

    reply.setCookie('oauth_state', state, {
      signed: true,
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    if (!env.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID.startsWith('mock_')) {
      // In development when real GitHub Client ID is not yet configured,
      // redirect with helpful query flag or info
      fastify.log.warn('GITHUB_CLIENT_ID is not configured with real GitHub credentials.');
      return reply.redirect(`${env.FRONTEND_URL}?oauth_notice=missing_credentials`);
    }

    const callbackUrl = `${env.NEXT_PUBLIC_API_URL}/auth/github/callback`;
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    githubAuthUrl.searchParams.set('scope', 'repo,read:user,user:email');
    githubAuthUrl.searchParams.set('state', state);

    return reply.redirect(githubAuthUrl.toString());
  });

  /**
   * GET /auth/github/callback
   * Exchanges code for GitHub access token, retrieves user, and creates session
   */
  fastify.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/auth/github/callback', async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    if (error) {
      fastify.log.error({ error, error_description }, 'GitHub OAuth returned an error');
      return reply.redirect(
        `${env.FRONTEND_URL}?oauth_error=${encodeURIComponent(error_description || error)}`
      );
    }

    if (!code || !state) {
      return reply.status(400).send({
        error: 'Missing required code or state parameter',
      });
    }

    // Verify CSRF state against signed cookie
    const stateCookie = request.cookies.oauth_state;
    if (!stateCookie) {
      return reply.status(400).send({
        error: 'Missing OAuth state cookie. Authentication session may have expired.',
      });
    }

    const unsignedState = request.unsignCookie(stateCookie);
    if (!unsignedState.valid || unsignedState.value !== state) {
      return reply.status(400).send({
        error: 'Invalid OAuth state token. Possible CSRF attack detected.',
      });
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
        fastify.log.error({ tokenData }, 'Failed to exchange authorization code for token');
        return reply.redirect(
          `${env.FRONTEND_URL}?oauth_error=${encodeURIComponent(
            tokenData.error_description || tokenData.error || 'Token exchange failed'
          )}`
        );
      }

      // Fetch authenticated GitHub user details
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'GitHub-Automation-Bot',
        },
      });

      if (!userResponse.ok) {
        fastify.log.error('Failed to fetch user profile from GitHub API');
        return reply.redirect(`${env.FRONTEND_URL}?oauth_error=Failed+to+fetch+user+profile`);
      }

      const ghUser = (await userResponse.json()) as {
        id: number;
        login: string;
      };

      // Upsert user in PostgreSQL database
      const user = await prisma.user.upsert({
        where: { githubId: String(ghUser.id) },
        update: {
          githubUsername: ghUser.login,
          githubAccessToken: tokenData.access_token,
        },
        create: {
          githubId: String(ghUser.id),
          githubUsername: ghUser.login,
          githubAccessToken: tokenData.access_token,
        },
      });

      // Issue signed httpOnly session cookie
      reply.setCookie('session', user.id, {
        signed: true,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      reply.clearCookie('oauth_state', { path: '/' });

      return reply.redirect(`${env.FRONTEND_URL}/dashboard`);
    } catch (err) {
      fastify.log.error({ err }, 'Unexpected error in OAuth callback');
      return reply.redirect(`${env.FRONTEND_URL}?oauth_error=Internal+authentication+error`);
    }
  });

  /**
   * GET /auth/me
   * Returns current authenticated user profile
   */
  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ authenticated: false, error: 'Unauthorized' });
    }

    const response: AuthMeResponse = {
      authenticated: true,
      user: {
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        createdAt: user.createdAt,
      },
    };

    return reply.send(response);
  });

  /**
   * POST /auth/logout
   * Invalidates authenticated session cookie
   */
  fastify.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie('session', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  /**
   * POST /auth/dev-login
   * Development & test convenience endpoint to simulate authenticated user
   * (Available only in non-production environments)
   */
  if (env.NODE_ENV !== 'production') {
    fastify.post<{
      Body: {
        username?: string;
        githubId?: string;
      };
    }>('/auth/dev-login', async (request, reply) => {
      const username = request.body?.username || 'developer';
      const githubId = request.body?.githubId || '12345678';

      const user = await prisma.user.upsert({
        where: { githubId },
        update: {
          githubUsername: username,
          githubAccessToken: 'gho_mock_dev_token_for_testing_12345',
        },
        create: {
          githubId,
          githubUsername: username,
          githubAccessToken: 'gho_mock_dev_token_for_testing_12345',
        },
      });

      reply.setCookie('session', user.id, {
        signed: true,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        authenticated: true,
        user: {
          id: user.id,
          githubId: user.githubId,
          githubUsername: user.githubUsername,
          createdAt: user.createdAt,
        },
      });
    });
  }
};
