import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { signSession, getSessionCookieOptions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = body?.username || 'developer';
    const githubId = body?.githubId || '12345678';

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

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        createdAt: user.createdAt,
      },
    });

    const signedSession = signSession(user.id);
    const cookieOpts = getSessionCookieOptions();

    response.cookies.set(cookieOpts.name, signedSession, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Dev login failed' }, { status: 500 });
  }
}
