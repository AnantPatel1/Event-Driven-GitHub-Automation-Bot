import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { env } from './env';
import type { AuthUser } from '@github-bot/shared';

const SESSION_COOKIE_NAME = 'session';
const SECRET = env.SESSION_SECRET || 'default_session_secret_at_least_32_chars_long_12345';

/**
 * Signs a session value using HMAC-SHA256
 */
export function signSession(value: string): string {
  const hmac = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  return `${value}.${hmac}`;
}

/**
 * Verifies and unsigns a signed session cookie value using constant-time comparison
 */
export function unsignSession(signedValue: string | undefined | null): string | null {
  if (!signedValue || typeof signedValue !== 'string') return null;

  // If in dev or format has no dot, check if it's already a raw valid UUID
  const lastDot = signedValue.lastIndexOf('.');
  if (lastDot === -1) {
    if (env.NODE_ENV !== 'production' && /^[0-9a-fA-F-]{36}$/.test(signedValue)) {
      return signedValue;
    }
    return null;
  }

  const value = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);

  // Compute expected HMAC in base64url and standard base64 for compatibility
  const hmacUrl = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  const hmacBase64 = crypto.createHmac('sha256', SECRET).update(value).digest('base64');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedUrlBuf = Buffer.from(hmacUrl, 'utf8');
  const expectedBaseBuf = Buffer.from(hmacBase64, 'utf8');

  let valid = false;
  if (sigBuf.length === expectedUrlBuf.length && crypto.timingSafeEqual(sigBuf, expectedUrlBuf)) {
    valid = true;
  } else if (sigBuf.length === expectedBaseBuf.length && crypto.timingSafeEqual(sigBuf, expectedBaseBuf)) {
    valid = true;
  }

  return valid ? value : null;
}

/**
 * Resolves the authenticated user from the incoming request cookies
 */
export async function getSessionUser(req?: Request): Promise<AuthUser | null> {
  let sessionCookie: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      sessionCookie = decodeURIComponent(match[1]);
    }
  }

  if (!sessionCookie) {
    try {
      const cookieStore = await cookies();
      sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // cookies() may throw outside Next server context
    }
  }

  if (!sessionCookie) return null;

  const userId = unsignSession(sessionCookie);
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubId: true,
        githubUsername: true,
        createdAt: true,
      },
    });

    return user || null;
  } catch (err) {
    console.error('Error looking up session user:', err);
    return null;
  }
}

/**
 * Cookie attributes for the session
 */
export function getSessionCookieOptions() {
  const isHttps = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  };
}
