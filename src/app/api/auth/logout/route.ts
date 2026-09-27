import { NextResponse } from 'next/server';
import { getSessionCookieOptions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  const cookieOpts = getSessionCookieOptions();
  response.cookies.set(cookieOpts.name, '', {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: 0,
  });

  return response;
}
