import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { env } from '@/lib/server/env';
import { unsignSession, signSession, getSessionCookieOptions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const origin = env.APP_URL || env.NEXT_PUBLIC_APP_URL || url.origin;

  if (error) {
    const errorUrl = new URL(origin);
    errorUrl.searchParams.set('oauth_error', errorDescription || error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing required code or state parameter' }, { status: 400 });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  const stateCookie = match ? decodeURIComponent(match[1]) : null;

  const validState = unsignSession(stateCookie);
  if (!validState || validState !== state) {
    return NextResponse.json(
      { error: 'Invalid OAuth state token. Possible CSRF attack detected.' },
      { status: 400 }
    );
  }

  try {
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
      const errorUrl = new URL(origin);
      errorUrl.searchParams.set(
        'oauth_error',
        tokenData.error_description || tokenData.error || 'Token exchange failed'
      );
      return NextResponse.redirect(errorUrl);
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
    });

    if (!userResponse.ok) {
      const errorUrl = new URL(origin);
      errorUrl.searchParams.set('oauth_error', 'Failed to fetch user profile');
      return NextResponse.redirect(errorUrl);
    }

    const ghUser = (await userResponse.json()) as {
      id: number;
      login: string;
    };

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

    const response = NextResponse.redirect(`${origin}/dashboard`);

    const signedSession = signSession(user.id);
    const cookieOpts = getSessionCookieOptions();

    response.cookies.set(cookieOpts.name, signedSession, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    response.cookies.delete('oauth_state');

    return response;
  } catch (err) {
    console.error('Unexpected error in OAuth callback:', err);
    const errorUrl = new URL(origin);
    errorUrl.searchParams.set('oauth_error', 'Internal authentication error');
    return NextResponse.redirect(errorUrl);
  }
}
