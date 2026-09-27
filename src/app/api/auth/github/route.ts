import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/server/env';
import { signSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const state = crypto.randomBytes(24).toString('hex');
  const signedState = signSession(state);

  const requestUrl = new URL(request.url);
  const origin = env.APP_URL || env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

  if (!env.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID.startsWith('mock_')) {
    const noticeUrl = new URL(origin);
    noticeUrl.searchParams.set('oauth_notice', 'missing_credentials');
    return NextResponse.redirect(noticeUrl);
  }

  const callbackUrl = `${origin}/api/auth/github/callback`;
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', callbackUrl);
  githubAuthUrl.searchParams.set('scope', 'repo,read:user,user:email');
  githubAuthUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(githubAuthUrl.toString());

  const isHttps = process.env.NODE_ENV === 'production';
  response.cookies.set('oauth_state', signedState, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return response;
}
