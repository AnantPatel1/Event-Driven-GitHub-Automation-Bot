import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import type { AuthMeResponse } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser(request);

  if (!user) {
    const response: AuthMeResponse = {
      authenticated: false,
      error: 'Unauthorized',
    };
    return NextResponse.json(response, { status: 401 });
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

  return NextResponse.json(response);
}
