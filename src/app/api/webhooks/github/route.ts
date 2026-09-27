import crypto from 'node:crypto';
import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { env } from '@/lib/server/env';
import { EventProcessor } from '@/lib/server/eventProcessor';

export const dynamic = 'force-dynamic';

/**
 * Validates GitHub HMAC-SHA256 signature using constant-time comparison
 */
export function verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const calculatedSignature = 'sha256=' + hmac.digest('hex');

  const sigBuffer = Buffer.from(signatureHeader, 'utf8');
  const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (sigBuffer.length !== calcBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, calcBuffer);
}

export async function POST(request: Request) {
  const signatureHeader = request.headers.get('x-hub-signature-256') || undefined;
  const deliveryId = request.headers.get('x-github-delivery') || undefined;
  const eventType = request.headers.get('x-github-event') || undefined;

  // 1. Validate mandatory webhook headers
  if (!signatureHeader) {
    return NextResponse.json(
      { error: 'Missing X-Hub-Signature-256 header. Request cannot be verified.' },
      { status: 401 }
    );
  }

  if (!deliveryId) {
    return NextResponse.json({ error: 'Missing X-GitHub-Delivery header.' }, { status: 400 });
  }

  if (!eventType) {
    return NextResponse.json({ error: 'Missing X-GitHub-Event header.' }, { status: 400 });
  }

  // 2. Validate supported events
  const supportedEvents = ['issues', 'pull_request', 'push', 'ping'];
  if (!supportedEvents.includes(eventType)) {
    return NextResponse.json(
      { status: 'ignored', reason: `Unsupported event type: ${eventType}` },
      { status: 200 }
    );
  }

  // Handle GitHub ping test event
  if (eventType === 'ping') {
    return NextResponse.json(
      { status: 'pong', message: 'GitHub webhook ping received successfully.' },
      { status: 200 }
    );
  }

  // 3. Cryptographic Signature Verification
  const rawBodyText = await request.text();
  const secret = env.GITHUB_WEBHOOK_SECRET || 'development_webhook_secret_key_32chars';

  const isValid = verifySignature(rawBodyText, signatureHeader, secret);
  if (!isValid) {
    console.warn(`Rejected webhook delivery ${deliveryId}: invalid HMAC signature.`);
    return NextResponse.json(
      { error: 'Invalid webhook signature. HMAC SHA-256 verification failed.' },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 4. Enforce Idempotency at the Database Level
  const existingEvent = await prisma.gitHubEvent.findUnique({
    where: { deliveryId },
  });

  if (existingEvent) {
    console.info(`Duplicate webhook delivery ${deliveryId} received. Enforcing idempotency.`);
    return NextResponse.json(
      {
        status: 'ignored',
        reason: 'duplicate_delivery',
        deliveryId,
        message: 'Event previously received and processed. Duplicate actions will not be performed.',
      },
      { status: 200 }
    );
  }

  // 5. Match Repository in Database
  const repoPayload = payload.repository as Record<string, unknown> | undefined;
  const githubRepoId = repoPayload?.id ? String(repoPayload.id) : null;
  const fullName = repoPayload?.full_name as string | undefined;

  let localRepo = null;
  if (githubRepoId || fullName) {
    localRepo = await prisma.repository.findFirst({
      where: {
        OR: [
          ...(githubRepoId ? [{ githubRepositoryId: githubRepoId }] : []),
          ...(fullName ? [{ fullName }] : []),
        ],
      },
      include: {
        rules: {
          where: { enabled: true },
        },
      },
    });
  }

  const action = (payload.action as string) || '';

  // Filter out internal secondary lifecycle events ('labeled', 'unlabeled')
  if (eventType === 'issues' && (action === 'labeled' || action === 'unlabeled')) {
    const hasSpecificRule = localRepo?.rules?.some((r: any) =>
      Array.isArray(r.conditions) &&
      r.conditions.some((c: any) => (c.field === 'action' || c.field === 'payload.action') && c.value === action)
    );

    if (!hasSpecificRule) {
      return NextResponse.json(
        {
          status: 'ignored',
          reason: 'secondary_label_event_ignored',
          deliveryId,
          message: 'Secondary issue label event ignored to prevent duplicate audit records.',
        },
        { status: 200 }
      );
    }
  }

  // 6. Persist Raw Webhook Event
  try {
    const event = await prisma.gitHubEvent.create({
      data: {
        deliveryId,
        repositoryId: localRepo?.id || null,
        eventType,
        action: (payload.action as string) || null,
        payload: payload as any,
        status: 'PENDING',
        receivedAt: new Date(),
      },
    });

    // 7. Non-blocking asynchronous processing using Next.js 16 after()
    try {
      after(async () => {
        await EventProcessor.processEvent(event.id);
      });
    } catch {
      // Fallback for environments where after() is not mounted
      EventProcessor.enqueue(event.id);
    }

    // 8. Return fast acknowledgment response to GitHub (<50ms)
    return NextResponse.json(
      {
        status: 'accepted',
        eventId: event.id,
        deliveryId,
        message: 'Webhook ingested and queued for asynchronous rule processing.',
      },
      { status: 202 }
    );
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        {
          status: 'ignored',
          reason: 'duplicate_delivery',
          deliveryId,
        },
        { status: 200 }
      );
    }

    console.error('Failed to persist webhook event:', err);
    return NextResponse.json({ error: 'Failed to persist webhook event.' }, { status: 500 });
  }
}
