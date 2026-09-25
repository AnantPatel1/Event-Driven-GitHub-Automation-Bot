import crypto from 'node:crypto';
import { buildApp } from '../apps/server/src/app.js';
import { prisma } from '../apps/server/src/lib/prisma.js';
import { evaluateRule } from '../apps/server/src/lib/ruleEngine.js';
import { ActionExecutor } from '../apps/server/src/lib/actionExecutor.js';

function computeHmacSignature(payload: string | Buffer, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

async function runComprehensiveTests() {
  console.log('🧪 Starting Comprehensive Automated Test Suite (Phases 4-11)...\n');

  const app = await buildApp();
  const webhookSecret = 'development_webhook_secret_key_32chars';
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
    // -------------------------------------------------------------
    // PART 1: Rule Engine Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- PART 1: Rule Engine Unit Tests ---');

    const ruleBug = {
      eventType: 'issues',
      conditions: [
        { field: 'issue.title', operator: 'contains' as const, value: 'bug' },
      ],
      actions: [{ type: 'github.add_label' as const, label: 'bug' }],
      enabled: true,
    };

    const payloadBug = {
      issue: {
        title: 'Bug: Safari login crashes',
        body: 'Clicking submit triggers a crash.',
        user: { login: 'octocat' },
      },
    };

    const payloadFeature = {
      issue: {
        title: 'Feature: Add Dark Mode',
        body: 'Please add a sleek dark mode.',
        user: { login: 'octocat' },
      },
    };

    assert(evaluateRule(ruleBug, 'issues', payloadBug) === true, 'Rule matches "contains bug" in title');
    assert(evaluateRule(ruleBug, 'issues', payloadFeature) === false, 'Rule does not match feature issue');

    const rulePrefix = {
      eventType: 'pull_request',
      conditions: [
        { field: 'pull_request.title', operator: 'starts_with' as const, value: 'fix:' },
      ],
      enabled: true,
    };

    assert(
      evaluateRule(rulePrefix, 'pull_request', { pull_request: { title: 'Fix: memory leak in worker' } }) === true,
      'Rule matches "starts_with fix:" (case-insensitive)'
    );
    assert(
      evaluateRule(rulePrefix, 'pull_request', { pull_request: { title: 'Docs: update readme' } }) === false,
      'Rule correctly rejects non-matching prefix'
    );

    // Disabled rule should never match
    const disabledRule = { ...ruleBug, enabled: false };
    assert(evaluateRule(disabledRule, 'issues', payloadBug) === false, 'Disabled rule returns false');

    // -------------------------------------------------------------
    // PART 2: Webhook Signature Verification Security
    // -------------------------------------------------------------
    console.log('\n--- PART 2: Webhook Signature Verification Security ---');

    const testPayload = JSON.stringify({
      action: 'opened',
      issue: {
        number: 101,
        title: 'Bug: Navigation broken',
        body: 'Details here',
      },
      repository: {
        id: 999111,
        name: 'test-repo',
        full_name: 'developer/test-repo',
      },
    });

    const validSig = computeHmacSignature(testPayload, webhookSecret);
    const invalidSig = 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const deliveryIdA = `deliv_${crypto.randomUUID()}`;

    // Test: Missing signature
    const missingSigRes = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': deliveryIdA,
        'x-github-event': 'issues',
      },
      payload: testPayload,
    });
    assert(missingSigRes.statusCode === 401, 'Missing signature returns 401 Unauthorized');

    // Test: Invalid signature
    const invalidSigRes = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': invalidSig,
        'x-github-delivery': deliveryIdA,
        'x-github-event': 'issues',
      },
      payload: testPayload,
    });
    assert(invalidSigRes.statusCode === 401, 'Invalid signature rejected with 401 Unauthorized');

    // Test: Valid signature accepted
    const validSigRes = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': validSig,
        'x-github-delivery': deliveryIdA,
        'x-github-event': 'issues',
      },
      payload: testPayload,
    });
    assert([200, 202].includes(validSigRes.statusCode), 'Valid signature accepted with 200/202');

    // -------------------------------------------------------------
    // PART 3: Idempotency Enforcement (Same delivery ID twice)
    // -------------------------------------------------------------
    console.log('\n--- PART 3: Idempotency Enforcement ---');

    // Replay identical webhook request with same deliveryIdA
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': validSig,
        'x-github-delivery': deliveryIdA,
        'x-github-event': 'issues',
      },
      payload: testPayload,
    });
    assert(duplicateRes.statusCode === 200, 'Duplicate delivery returns 200');
    const duplicateBody = JSON.parse(duplicateRes.payload);
    assert(duplicateBody.status === 'ignored', 'Duplicate delivery flagged as ignored');
    assert(duplicateBody.reason === 'duplicate_delivery', 'Reason indicates duplicate_delivery');

    // Verify exactly 1 event persisted in PostgreSQL
    const eventCount = await prisma.gitHubEvent.count({
      where: { deliveryId: deliveryIdA },
    });
    assert(eventCount === 1, 'Strict Idempotency: Exactly 1 record exists in PostgreSQL for deliveryId');

    // -------------------------------------------------------------
    // PART 4: End-to-End Rule Execution & BotAction Audit Logs
    // -------------------------------------------------------------
    console.log('\n--- PART 4: End-to-End Rule Execution & BotAction Audit Logs ---');

    // Create user and repository
    const testUser = await prisma.user.upsert({
      where: { githubId: '888001' },
      update: {},
      create: {
        githubId: '888001',
        githubUsername: 'e2e-tester',
        githubAccessToken: 'gho_mock_token_for_e2e_tests',
      },
    });

    const testRepo = await prisma.repository.upsert({
      where: {
        userId_githubRepositoryId: {
          userId: testUser.id,
          githubRepositoryId: '88800101',
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        githubRepositoryId: '88800101',
        owner: 'e2e-tester',
        name: 'automation-app',
        fullName: 'e2e-tester/automation-app',
        webhookId: 'mock_wh_123',
      },
    });

    // Clean up any previous test rules for this repository
    await prisma.rule.deleteMany({
      where: { repositoryId: testRepo.id },
    });

    // Create automation rule: When issue opened & title contains "bug" -> add label "bug", notify Slack
    const rule = await prisma.rule.create({
      data: {
        repositoryId: testRepo.id,
        eventType: 'issues',
        conditions: [
          { field: 'issue.title', operator: 'contains', value: 'bug' },
        ],
        actions: [
          { type: 'github.add_label', label: 'bug' },
          { type: 'slack.notify', message: 'Automated triage alert' },
        ],
        enabled: true,
      },
    });
    assert(!!rule.id, 'Automation rule created in database');

    // Simulate incoming webhook: Bug issue opened
    const simRes = await app.inject({
      method: 'POST',
      url: '/webhooks/simulate',
      payload: {
        eventType: 'issues',
        action: 'opened',
        repositoryFullName: 'e2e-tester/automation-app',
        issueTitle: 'Bug: test GitHub automation',
        issueBody: 'Testing rule engine execution',
        issueNumber: 42,
      },
    });
    assert(simRes.statusCode === 200, 'Simulated webhook processed with 200');
    const simBody = JSON.parse(simRes.payload);
    assert(simBody.event.status === 'PROCESSED', 'Event status transitioned to PROCESSED');
    assert(simBody.event.actions.length === 2, 'Both downstream actions (GitHub label + Slack) recorded');

    const githubAction = simBody.event.actions.find((a: any) => a.type === 'github.add_label');
    const slackAction = simBody.event.actions.find((a: any) => a.type === 'slack.notify');
    assert(githubAction?.status === 'SUCCESS', 'GitHub label action executed with status SUCCESS');
    assert(slackAction?.status === 'SUCCESS', 'Slack notification action executed with status SUCCESS');

    // -------------------------------------------------------------
    // PART 5: Retry & Error Handling
    // -------------------------------------------------------------
    console.log('\n--- PART 5: Retry & Error Handling ---');

    // Execute unsupported action to verify failure logging without infinite retry
    const errorEvent = await prisma.gitHubEvent.create({
      data: {
        deliveryId: `err_${crypto.randomUUID()}`,
        eventType: 'issues',
        payload: { issue: { number: 99 } },
        status: 'PENDING',
      },
    });

    try {
      await ActionExecutor.executeAction(
        { type: 'unsupported.action' as any },
        {
          eventId: errorEvent.id,
          owner: 'test',
          repo: 'test',
          issueOrPrNumber: 99,
          eventType: 'issues',
          accessToken: 'gho_mock',
        }
      );
    } catch {
      // Expected to fail
    }

    const failedActionRecord = await prisma.botAction.findFirst({
      where: { eventId: errorEvent.id },
    });
    assert(failedActionRecord?.status === 'FAILED', 'Failed action properly recorded in BotAction as FAILED');
    assert(!!failedActionRecord?.error, 'BotAction includes explicit error message');

    console.log(`\n🎉 All Comprehensive Tests Passed (${passedTests}/${totalTests})!`);
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

runComprehensiveTests();
