import { buildApp } from '../apps/server/src/app.js';
import { prisma } from '../apps/server/src/lib/prisma.js';

async function runRepositoryTests() {
  console.log('🧪 Starting Phase 3: Repository Connection & Authorization Tests...\n');

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
    // Setup Test User A
    const userALoginRes = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: {
        username: 'user-alpha',
        githubId: '777001',
      },
    });
    assert(userALoginRes.statusCode === 200, 'User A logged in successfully');
    const userASession = userALoginRes.cookies.find((c) => c.name === 'session')!.value;
    const userABody = JSON.parse(userALoginRes.payload);

    // Setup Test User B (for authorization attacks)
    const userBLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: {
        username: 'user-bravo',
        githubId: '777002',
      },
    });
    assert(userBLoginRes.statusCode === 200, 'User B logged in successfully');
    const userBSession = userBLoginRes.cookies.find((c) => c.name === 'session')!.value;

    // Test 1: GET /repositories without session returns 401
    const unauthGetRes = await app.inject({
      method: 'GET',
      url: '/repositories',
    });
    assert(unauthGetRes.statusCode === 401, 'GET /repositories without session returns 401');

    // Test 2: GET /repositories with User A session returns repository list
    const reposGetRes = await app.inject({
      method: 'GET',
      url: '/repositories',
      cookies: { session: userASession },
    });
    assert(reposGetRes.statusCode === 200, 'GET /repositories with User A returns 200');
    const reposBody = JSON.parse(reposGetRes.payload);
    assert(Array.isArray(reposBody.repositories), 'Response contains repositories array');
    assert(reposBody.repositories.length > 0, 'User A has accessible repositories');
    const firstRepo = reposBody.repositories[0];
    assert(firstRepo.fullName === 'user-alpha/project-a', 'First repository full_name matches user scope');
    assert(firstRepo.isConnected === false, 'Initially repository isConnected is false');

    // Test 3: POST /repositories/:id/connect without session returns 401
    const unauthConnectRes = await app.inject({
      method: 'POST',
      url: `/repositories/${firstRepo.githubRepositoryId}/connect`,
    });
    assert(unauthConnectRes.statusCode === 401, 'POST /repositories/:id/connect without session returns 401');

    // Test 4: POST /repositories/:id/connect with non-existent / unauthorized repo ID fails
    const invalidConnectRes = await app.inject({
      method: 'POST',
      url: '/repositories/non_existent_repo_99999/connect',
      cookies: { session: userASession },
    });
    assert(invalidConnectRes.statusCode === 400, 'Connecting unauthorized/nonexistent repo returns 400');

    // Test 5: POST /repositories/:id/connect with valid repo connects and creates DB record
    const connectRes = await app.inject({
      method: 'POST',
      url: `/repositories/${firstRepo.githubRepositoryId}/connect`,
      cookies: { session: userASession },
    });
    assert(connectRes.statusCode === 200, 'Connecting valid repository returns 200');
    const connectBody = JSON.parse(connectRes.payload);
    assert(connectBody.success === true, 'Response indicates success');
    assert(connectBody.repository.fullName === 'user-alpha/project-a', 'Connected repository full name matches');
    assert(!!connectBody.repository.webhookId, 'Webhook ID is assigned');

    // Verify in PostgreSQL database
    const dbRepo = await prisma.repository.findFirst({
      where: {
        userId: userABody.user.id,
        githubRepositoryId: String(firstRepo.githubRepositoryId),
      },
    });
    assert(!!dbRepo, 'Repository record exists in PostgreSQL via Prisma');
    assert(dbRepo?.owner === 'user-alpha', 'Stored repository owner matches');
    assert(dbRepo?.webhookId === connectBody.repository.webhookId, 'Stored webhook ID matches');

    // Test 6: GET /repositories now reflects isConnected === true
    const reposAfterConnectRes = await app.inject({
      method: 'GET',
      url: '/repositories',
      cookies: { session: userASession },
    });
    const reposAfterBody = JSON.parse(reposAfterConnectRes.payload);
    const updatedFirstRepo = reposAfterBody.repositories.find(
      (r: any) => r.githubRepositoryId === firstRepo.githubRepositoryId
    );
    assert(updatedFirstRepo.isConnected === true, 'Repository isConnected is now true');
    assert(!!updatedFirstRepo.webhookId, 'Repository lists webhookId');

    // Test 7: Authorization Check: User B cannot disconnect User A's repository
    const userBDisconnectRes = await app.inject({
      method: 'DELETE',
      url: `/repositories/${dbRepo!.id}/disconnect`,
      cookies: { session: userBSession },
    });
    assert(
      userBDisconnectRes.statusCode === 404,
      'User B cannot disconnect User A repository (returns 404 Forbidden/Not Found)'
    );

    // Verify repository still exists in database
    const repoStillExists = await prisma.repository.findUnique({
      where: { id: dbRepo!.id },
    });
    assert(!!repoStillExists, 'Repository remained secure in database after unauthorized attempt');

    // Test 8: User A disconnects their own repository
    const disconnectRes = await app.inject({
      method: 'DELETE',
      url: `/repositories/${dbRepo!.id}/disconnect`,
      cookies: { session: userASession },
    });
    assert(disconnectRes.statusCode === 200, 'User A disconnects own repository with 200');

    // Verify repository is removed from database
    const repoDeleted = await prisma.repository.findUnique({
      where: { id: dbRepo!.id },
    });
    assert(!repoDeleted, 'Repository successfully removed from database');

    console.log(`\n🎉 All Phase 3 Repository Connection tests passed (${passedTests}/${totalTests})!`);
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runRepositoryTests();
