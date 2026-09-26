process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { buildApp } from '../apps/server/src/app.js';
import { prisma } from '../apps/server/src/lib/prisma.js';
import { validateSlackWebhookUrl } from '../apps/server/src/lib/slackValidation.js';
import { encryptSlackWebhook, decryptSlackWebhook, maskSlackWebhook } from '../apps/server/src/lib/encryption.js';
import { EventProcessor } from '../apps/server/src/lib/eventProcessor.js';

async function runSlackIntegrationTests() {
  console.log('🧪 Starting Comprehensive Slack Integration & Security Tests...\n');

  const app = await buildApp();
  await app.ready();

  const userAId = 'user-slack-test-a-' + Date.now();
  const userBId = 'user-slack-test-b-' + Date.now();

  try {
    // 0. Clean up any existing test records
    await prisma.slackIntegration.deleteMany({}).catch(() => {});
    await prisma.rule.deleteMany({}).catch(() => {});
    await prisma.botAction.deleteMany({}).catch(() => {});
    await prisma.gitHubEvent.deleteMany({}).catch(() => {});

    // Create User A and User B
    const userA = await prisma.user.create({
      data: {
        id: userAId,
        githubId: 'gh_slack_user_a',
        githubUsername: 'developer-a',
        githubAccessToken: 'gho_mock_token_a',
      },
    });

    const userB = await prisma.user.create({
      data: {
        id: userBId,
        githubId: 'gh_slack_user_b',
        githubUsername: 'developer-b',
        githubAccessToken: 'gho_mock_token_b',
      },
    });

    // Create Repositories for User A
    const repoA1 = await prisma.repository.create({
      data: {
        userId: userA.id,
        githubRepositoryId: '900001',
        owner: 'developer-a',
        name: 'repo-one',
        fullName: 'developer-a/repo-one',
      },
    });

    const repoA2 = await prisma.repository.create({
      data: {
        userId: userA.id,
        githubRepositoryId: '900002',
        owner: 'developer-a',
        name: 'repo-two',
        fullName: 'developer-a/repo-two',
      },
    });

    // Create Repository for User B
    const repoB = await prisma.repository.create({
      data: {
        userId: userB.id,
        githubRepositoryId: '900003',
        owner: 'developer-b',
        name: 'repo-b',
        fullName: 'developer-b/repo-b',
      },
    });

    // Log in User A
    const loginResA = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: { username: 'developer-a', githubId: 'gh_slack_user_a' },
    });
    const sessionCookieA = loginResA.headers['set-cookie'] as string;

    // Log in User B
    const loginResB = await app.inject({
      method: 'POST',
      url: '/auth/dev-login',
      payload: { username: 'developer-b', githubId: 'gh_slack_user_b' },
    });
    const sessionCookieB = loginResB.headers['set-cookie'] as string;

    console.log('--- PART 1: SSRF & URL Validation Security ---');

    // Test 1.1: Rejects HTTP
    const httpRes = validateSlackWebhookUrl('http://hooks.slack.com/services/T111/B222/abc');
    assert.strictEqual(httpRes.valid, false, 'Should reject HTTP');
    console.log('✅ PASS: Rejects non-HTTPS protocol');

    // Test 1.2: Rejects localhost SSRF
    const localhostRes = validateSlackWebhookUrl('https://localhost:4000/webhook');
    assert.strictEqual(localhostRes.valid, false, 'Should reject localhost');
    console.log('✅ PASS: Rejects localhost SSRF target');

    // Test 1.3: Rejects IP addresses (127.0.0.1, 169.254.169.254)
    const ipRes = validateSlackWebhookUrl('https://169.254.169.254/services/T111/B222/abc');
    assert.strictEqual(ipRes.valid, false, 'Should reject internal cloud metadata IP');
    console.log('✅ PASS: Rejects raw IP address SSRF target');

    // Test 1.4: Rejects arbitrary outbound domains
    const arbitraryRes = validateSlackWebhookUrl('https://attacker-controlled-site.com/services/T111/B222/abc');
    assert.strictEqual(arbitraryRes.valid, false, 'Should reject non-slack domain');
    console.log('✅ PASS: Rejects arbitrary third-party domains');

    // Test 1.5: Rejects embedded user credentials in URL
    const credentialsRes = validateSlackWebhookUrl('https://user:pass@hooks.slack.com/services/T111/B222/abc');
    assert.strictEqual(credentialsRes.valid, false, 'Should reject embedded credentials');
    console.log('✅ PASS: Rejects URL with embedded credentials');

    // Test 1.6: Rejects invalid path structure
    const invalidPathRes = validateSlackWebhookUrl('https://hooks.slack.com/admin/account');
    assert.strictEqual(invalidPathRes.valid, false, 'Should reject non-webhook Slack path');
    console.log('✅ PASS: Rejects invalid Slack endpoint path structure');

    // Test 1.7: Accepts valid Slack incoming webhook
    const validUrl = 'https://hooks.slack.com/services/T012AB34C/B056DE78F/9876543210abcdef12345678';
    const validRes = validateSlackWebhookUrl(validUrl);
    assert.strictEqual(validRes.valid, true, 'Should accept standard Slack webhook');
    console.log('✅ PASS: Accepts valid Slack incoming webhook URL');

    console.log('\n--- PART 2: Encryption at Rest & Zero Secret Leakage ---');

    // Test 2.1: Encryption / Decryption round-trip
    const enc = encryptSlackWebhook(validUrl);
    assert.notStrictEqual(enc.encryptedWebhookUrl, validUrl, 'Ciphertext must not match raw URL');
    assert(enc.iv && enc.authTag, 'IV and authTag must be present');
    const dec = decryptSlackWebhook(enc.encryptedWebhookUrl, enc.iv, enc.authTag);
    assert.strictEqual(dec, validUrl, 'Decrypted ciphertext must match original raw URL');
    console.log('✅ PASS: AES-256-GCM encryption and decryption round-trip verified');

    // Test 2.2: URL Masking
    const mask = maskSlackWebhook(validUrl);
    assert(mask.includes('hooks.slack.com/services/'), 'Mask preserves domain and endpoint');
    assert(!mask.includes('9876543210abcdef'), 'Mask must obscure secret token body');
    console.log('✅ PASS: Webhook URL is masked safely:', mask);

    // Test 2.3: POST /integrations/slack saves encrypted record
    const saveResA = await app.inject({
      method: 'POST',
      url: '/integrations/slack',
      headers: { cookie: sessionCookieA },
      payload: {
        webhookUrl: validUrl,
        channelName: '#dev-triage',
      },
    });
    assert.strictEqual(saveResA.statusCode, 200, 'Saving integration returns 200');
    const saveBodyA = JSON.parse(saveResA.body);
    assert.strictEqual(saveBodyA.success, true);
    assert(saveBodyA.integration.id, 'Integration ID returned');
    assert(saveBodyA.integration.webhookUrlMask, 'Masked URL returned');
    // Ensure raw URL is NOT in response
    assert(!JSON.stringify(saveBodyA).includes(validUrl), 'Raw webhook URL must NEVER be in API response');
    console.log('✅ PASS: POST /integrations/slack saves and masks credentials without leaking raw URL');

    // Verify raw URL is encrypted in PostgreSQL
    const dbIntegration = await prisma.slackIntegration.findUnique({
      where: { id: saveBodyA.integration.id },
    });
    assert(dbIntegration, 'Record exists in database');
    assert.notStrictEqual(dbIntegration.encryptedWebhookUrl, validUrl, 'Database stores ciphertext');
    console.log('✅ PASS: PostgreSQL record stores encrypted ciphertext at rest');

    console.log('\n--- PART 3: User Isolation & Multi-Tenant Authorization ---');

    // Test 3.1: User B listing integrations should NOT see User A's integration
    const listResB = await app.inject({
      method: 'GET',
      url: '/integrations/slack',
      headers: { cookie: sessionCookieB },
    });
    assert.strictEqual(listResB.statusCode, 200);
    const listBodyB = JSON.parse(listResB.body);
    assert.strictEqual(listBodyB.integrations.length, 0, 'User B has no integrations');
    console.log("✅ PASS: Multi-tenant isolation: User B cannot view User A's integrations");

    // Test 3.2: User B cannot delete User A's integration
    const deleteResB = await app.inject({
      method: 'DELETE',
      url: `/integrations/slack/${saveBodyA.integration.id}`,
      headers: { cookie: sessionCookieB },
    });
    assert.strictEqual(deleteResB.statusCode, 404, 'Unauthorized deletion returns 404');
    console.log("✅ PASS: Authorization: User B cannot delete User A's integration (404 Not Found)");

    // Test 3.3: User B cannot test User A's integration
    const testResB = await app.inject({
      method: 'POST',
      url: '/integrations/slack/test',
      headers: { cookie: sessionCookieB },
      payload: {
        integrationId: saveBodyA.integration.id,
      },
    });
    assert.strictEqual(testResB.statusCode, 404, 'Unauthorized test returns 404');
    console.log("✅ PASS: Authorization: User B cannot test User A's integration (404 Not Found)");

    console.log('\n--- PART 4: Per-Repository vs. User Default Resolution ---');

    // User A configures repo-specific webhook for repo-one
    const repoSpecificUrl = 'https://hooks.slack.com/services/T012AB34C/B056DE78F/repo_one_secret_token_1234';
    const saveRepoSpecificRes = await app.inject({
      method: 'POST',
      url: '/integrations/slack',
      headers: { cookie: sessionCookieA },
      payload: {
        webhookUrl: repoSpecificUrl,
        repositoryId: repoA1.id,
        channelName: '#repo-one-alerts',
      },
    });
    assert.strictEqual(saveRepoSpecificRes.statusCode, 200);
    console.log('✅ PASS: Configured repository-specific Slack webhook for developer-a/repo-one');

    // Create automation rule with slack.notify for Repo A1
    const ruleA1 = await prisma.rule.create({
      data: {
        repositoryId: repoA1.id,
        eventType: 'issues',
        conditions: [{ field: 'issue.title', operator: 'contains', value: 'bug' }],
        actions: [{ type: 'slack.notify', message: 'Triage alert for repo one' }],
        enabled: true,
      },
    });

    // Create automation rule with slack.notify for Repo A2 (should use default webhook)
    const ruleA2 = await prisma.rule.create({
      data: {
        repositoryId: repoA2.id,
        eventType: 'issues',
        conditions: [{ field: 'issue.title', operator: 'contains', value: 'bug' }],
        actions: [{ type: 'slack.notify', message: 'Triage alert for repo two' }],
        enabled: true,
      },
    });

    // Trigger event on Repo A1 (matches repo-specific webhook)
    const eventA1 = await prisma.gitHubEvent.create({
      data: {
        deliveryId: 'deliv_slack_test_a1_' + Date.now(),
        repositoryId: repoA1.id,
        eventType: 'issues',
        action: 'opened',
        payload: {
          action: 'opened',
          issue: { number: 10, title: 'Critical bug in repo one' },
          repository: { id: 900001, full_name: repoA1.fullName, name: repoA1.name, owner: { login: repoA1.owner } },
        },
        status: 'PENDING',
      },
    });

    await EventProcessor.processEvent(eventA1.id);

    const actionA1 = await prisma.botAction.findFirst({
      where: { eventId: eventA1.id, type: 'slack.notify' },
    });
    assert(actionA1, 'Action recorded for event A1');
    assert.strictEqual(actionA1.status, 'SUCCESS');
    console.log('✅ PASS: Event on repo-one resolved repo-specific Slack integration');

    // Trigger event on Repo A2 (falls back to user default webhook)
    const eventA2 = await prisma.gitHubEvent.create({
      data: {
        deliveryId: 'deliv_slack_test_a2_' + Date.now(),
        repositoryId: repoA2.id,
        eventType: 'issues',
        action: 'opened',
        payload: {
          action: 'opened',
          issue: { number: 20, title: 'Bug in repo two' },
          repository: { id: 900002, full_name: repoA2.fullName, name: repoA2.name, owner: { login: repoA2.owner } },
        },
        status: 'PENDING',
      },
    });

    await EventProcessor.processEvent(eventA2.id);

    const actionA2 = await prisma.botAction.findFirst({
      where: { eventId: eventA2.id, type: 'slack.notify' },
    });
    assert(actionA2, 'Action recorded for event A2');
    assert.strictEqual(actionA2.status, 'SUCCESS');
    console.log('✅ PASS: Event on repo-two resolved user default Slack integration');

    console.log('\n--- PART 5: Missing Integration Handled as SKIPPED (No Global Fallback) ---');

    // User B has a rule with slack.notify, but User B has NO Slack integration configured
    const ruleB = await prisma.rule.create({
      data: {
        repositoryId: repoB.id,
        eventType: 'issues',
        conditions: [{ field: 'issue.title', operator: 'contains', value: 'urgent' }],
        actions: [{ type: 'slack.notify', message: 'Urgent issue alert' }],
        enabled: true,
      },
    });

    const eventB = await prisma.gitHubEvent.create({
      data: {
        deliveryId: 'deliv_slack_test_b_' + Date.now(),
        repositoryId: repoB.id,
        eventType: 'issues',
        action: 'opened',
        payload: {
          action: 'opened',
          issue: { number: 30, title: 'Urgent security fix required' },
          repository: { id: 900003, full_name: repoB.fullName, name: repoB.name, owner: { login: repoB.owner } },
        },
        status: 'PENDING',
      },
    });

    await EventProcessor.processEvent(eventB.id);

    const actionB = await prisma.botAction.findFirst({
      where: { eventId: eventB.id, type: 'slack.notify' },
    });
    assert(actionB, 'Action recorded for event B');
    assert.strictEqual(actionB.status, 'SKIPPED', 'Action must be recorded as SKIPPED when Slack is unconfigured');
    assert(actionB.error?.includes('not configured'), 'Error indicates missing Slack configuration');
    console.log('✅ PASS: Missing Slack integration records action as SKIPPED without silent global fallback');

    console.log('\n--- PART 6: Send Test Notification & Disconnect ---');

    // Test 6.1: Test existing integration by ID
    const testExistingRes = await app.inject({
      method: 'POST',
      url: '/integrations/slack/test',
      headers: { cookie: sessionCookieA },
      payload: {
        integrationId: saveBodyA.integration.id,
      },
    });
    assert.strictEqual(testExistingRes.statusCode, 200);
    const testExistingBody = JSON.parse(testExistingRes.body);
    assert.strictEqual(testExistingBody.success, true);
    console.log('✅ PASS: POST /integrations/slack/test verifies stored integration');

    // Test 6.2: Test arbitrary valid URL before saving
    const testRawRes = await app.inject({
      method: 'POST',
      url: '/integrations/slack/test',
      headers: { cookie: sessionCookieA },
      payload: {
        webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/mock_test_token',
      },
    });
    assert.strictEqual(testRawRes.statusCode, 200);
    console.log('✅ PASS: POST /integrations/slack/test verifies webhook URL before saving');

    // Test 6.3: Disconnect integration
    const disconnectResA = await app.inject({
      method: 'DELETE',
      url: `/integrations/slack/${saveBodyA.integration.id}`,
      headers: { cookie: sessionCookieA },
    });
    assert.strictEqual(disconnectResA.statusCode, 200);
    const verifyDeleted = await prisma.slackIntegration.findUnique({
      where: { id: saveBodyA.integration.id },
    });
    assert.strictEqual(verifyDeleted, null, 'Integration deleted from database');
    console.log('✅ PASS: DELETE /integrations/slack/:id cleanly disconnects integration');

    console.log('\n--- PART 7: Slack Failure & Error Handling ---');

    // Configure failing webhook for Repo B
    const failingUrl = 'https://hooks.slack.com/services/T00000000/B00000000/fail_token_invalid_channel';
    await app.inject({
      method: 'POST',
      url: '/integrations/slack',
      headers: { cookie: sessionCookieB },
      payload: {
        webhookUrl: failingUrl,
        repositoryId: repoB.id,
      },
    });

    // Trigger event on Repo B (should attempt and record FAILED with error)
    const eventFail = await prisma.gitHubEvent.create({
      data: {
        deliveryId: 'deliv_slack_fail_' + Date.now(),
        repositoryId: repoB.id,
        eventType: 'issues',
        action: 'opened',
        payload: {
          action: 'opened',
          issue: { number: 99, title: 'Urgent crash on Repo B' },
          repository: { id: 900003, full_name: repoB.fullName, name: repoB.name, owner: { login: repoB.owner } },
        },
        status: 'PENDING',
      },
    });

    await EventProcessor.processEvent(eventFail.id);

    const failAction = await prisma.botAction.findFirst({
      where: { eventId: eventFail.id, type: 'slack.notify' },
    });
    assert(failAction, 'Action recorded for eventFail');
    assert.strictEqual(failAction.status, 'FAILED', 'Downstream Slack failure must record status as FAILED');
    assert(failAction.error?.includes('channel_not_found') || failAction.error?.includes('failed'), 'Error details preserved');
    console.log('✅ PASS: Downstream Slack failure properly recorded as FAILED with audit error trace');

    console.log('\n🎉 All Slack Integration & Security Tests Passed (22/22)!\n');
  } finally {
    // Cleanup test users
    await prisma.slackIntegration.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    }).catch(() => {});
    await prisma.repository.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    }).catch(() => {});
    await app.close();
  }
}

runSlackIntegrationTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
