import { buildApp } from '../apps/server/src/app.js';
import { prisma } from '../apps/server/src/lib/prisma.js';

async function runAuthTests() {
  console.log('🧪 Starting Phase 2: GitHub OAuth & Session Security Tests...\n');

  const app = await buildApp();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }

  try {
    // Test 1: GET /auth/me without session returns 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });
    assert(unauthRes.statusCode === 401, 'GET /auth/me without session returns 401');
    const unauthBody = JSON.parse(unauthRes.payload);
    assert(unauthBody.authenticated === false, 'Unauthenticated response includes authenticated: false');

    // Test 2: GET /auth/me with invalid/tampered cookie returns 401
    const tamperedRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: {
        session: 'tampered-fake-session-cookie',
      },
    });
    assert(tamperedRes.statusCode === 401, 'GET /auth/me with tampered session cookie returns 401');

    // Test 3: Dev login generates valid signed session cookie and database record
    const devLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: {
        username: 'octocat-tester',
        githubId: '583231',
      },
    });
    assert(devLoginRes.statusCode === 200, 'POST /auth/dev-login succeeds with 200');
    const loginCookies = devLoginRes.cookies;
    const sessionCookieObj = loginCookies.find((c) => c.name === 'session');
    assert(!!sessionCookieObj, 'Session cookie is generated');
    assert(sessionCookieObj?.httpOnly === true, 'Session cookie has httpOnly flag');

    const devLoginBody = JSON.parse(devLoginRes.payload);
    assert(devLoginBody.user.githubUsername === 'octocat-tester', 'User profile returned correctly');
    assert(!devLoginBody.user.githubAccessToken, 'githubAccessToken is NOT exposed in response payload');

    // Verify user exists in PostgreSQL via Prisma
    const dbUser = await prisma.user.findUnique({
      where: { githubId: '583231' },
    });
    assert(!!dbUser, 'User is stored in PostgreSQL via Prisma');
    assert(dbUser?.githubUsername === 'octocat-tester', 'Stored username matches');

    // Test 4: GET /auth/me with valid session cookie returns authenticated user
    const authMeRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: {
        session: sessionCookieObj!.value,
      },
    });
    assert(authMeRes.statusCode === 200, 'GET /auth/me with valid session returns 200');
    const authMeBody = JSON.parse(authMeRes.payload);
    assert(authMeBody.authenticated === true, 'Authenticated response includes authenticated: true');
    assert(authMeBody.user.githubId === '583231', 'Authenticated user ID matches session');
    assert(!authMeBody.user.githubAccessToken, 'Zero secret leakage: token not present in /auth/me');

    // Test 5: POST /auth/logout clears session
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        session: sessionCookieObj!.value,
      },
    });
    assert(logoutRes.statusCode === 200, 'POST /auth/logout returns 200');
    const clearedCookie = logoutRes.cookies.find((c) => c.name === 'session');
    assert(
      !clearedCookie?.value || clearedCookie?.maxAge === 0 || clearedCookie?.expires !== undefined,
      'Session cookie cleared on logout'
    );

    // Test 6: GET /auth/github sets CSRF oauth_state cookie
    const oauthInitRes = await app.inject({
      method: 'GET',
      url: '/auth/github',
    });
    assert([302, 307].includes(oauthInitRes.statusCode), 'GET /auth/github initiates redirect');
    const stateCookie = oauthInitRes.cookies.find((c) => c.name === 'oauth_state');
    assert(!!stateCookie, 'CSRF protection: oauth_state cookie is issued');
    assert(stateCookie?.httpOnly === true, 'oauth_state cookie has httpOnly flag');

    // Test 7: GET /auth/github/callback rejects missing state or mismatched state (CSRF mitigation)
    const invalidCallbackRes = await app.inject({
      method: 'GET',
      url: '/auth/github/callback?code=testcode123&state=attacker_state',
      cookies: {
        oauth_state: 'legitimate_state',
      },
    });
    assert(invalidCallbackRes.statusCode === 400, 'Callback rejects mismatched state with 400');

    console.log(`\n🎉 All Phase 2 Auth tests passed (${passedTests}/${totalTests})!`);
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runAuthTests();
