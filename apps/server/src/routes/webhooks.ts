import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { EventProcessor } from '../lib/eventProcessor.js';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

/**
 * Validates GitHub HMAC-SHA256 signature using constant-time comparison
 */
export function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
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

export const webhookRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /webhooks/github
   * Primary GitHub webhook receiver endpoint
   */
  fastify.post('/webhooks/github', async (request: RawBodyRequest, reply) => {
    const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
    const deliveryId = request.headers['x-github-delivery'] as string | undefined;
    const eventType = request.headers['x-github-event'] as string | undefined;

    // 1. Validate mandatory webhook headers
    if (!signatureHeader) {
      return reply.status(401).send({
        error: 'Missing X-Hub-Signature-256 header. Request cannot be verified.',
      });
    }

    if (!deliveryId) {
      return reply.status(400).send({
        error: 'Missing X-GitHub-Delivery header.',
      });
    }

    if (!eventType) {
      return reply.status(400).send({
        error: 'Missing X-GitHub-Event header.',
      });
    }

    // 2. Validate supported events
    const supportedEvents = ['issues', 'pull_request', 'push', 'ping'];
    if (!supportedEvents.includes(eventType)) {
      return reply.status(200).send({
        status: 'ignored',
        reason: `Unsupported event type: ${eventType}`,
      });
    }

    // Handle GitHub ping test event
    if (eventType === 'ping') {
      return reply.status(200).send({
        status: 'pong',
        message: 'GitHub webhook ping received successfully.',
      });
    }

    // 3. Cryptographic Signature Verification
    const secret = env.GITHUB_WEBHOOK_SECRET || 'development_webhook_secret_key_32chars';
    const rawBodyBuffer = request.rawBody || Buffer.from(JSON.stringify(request.body || {}));

    const isValid = verifySignature(rawBodyBuffer, signatureHeader, secret);
    if (!isValid) {
      fastify.log.warn({ deliveryId }, 'Rejected webhook request with invalid HMAC signature.');
      return reply.status(401).send({
        error: 'Invalid webhook signature. HMAC SHA-256 verification failed.',
      });
    }

    const payload = request.body as Record<string, unknown>;

    // 4. Enforce Idempotency at the Database Level
    // Check if deliveryId has already been recorded
    const existingEvent = await prisma.gitHubEvent.findUnique({
      where: { deliveryId },
    });

    if (existingEvent) {
      fastify.log.info({ deliveryId }, 'Duplicate webhook delivery received. Enforcing idempotency.');
      return reply.status(200).send({
        status: 'ignored',
        reason: 'duplicate_delivery',
        deliveryId,
        message: 'Event previously received and processed. Duplicate actions will not be performed.',
      });
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

    // Filter out internal secondary lifecycle events (like 'labeled', 'unlabeled')
    // triggered by downstream bot actions to prevent duplicate delivery records and action loops
    if (eventType === 'issues' && (action === 'labeled' || action === 'unlabeled')) {
      const hasSpecificRule = localRepo?.rules?.some((r: any) =>
        Array.isArray(r.conditions) &&
        r.conditions.some((c: any) => (c.field === 'action' || c.field === 'payload.action') && c.value === action)
      );

      if (!hasSpecificRule) {
        fastify.log.info({ deliveryId, action }, 'Ignoring secondary issue label event to prevent duplicate delivery records.');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'secondary_label_event_ignored',
          deliveryId,
          message: 'Secondary issue label event ignored to prevent duplicate audit records.',
        });
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

      // 7. Enqueue asynchronous processing
      EventProcessor.enqueue(event.id);

      // 8. Return fast acknowledgment response to GitHub
      return reply.status(202).send({
        status: 'accepted',
        eventId: event.id,
        deliveryId,
        message: 'Webhook ingested and queued for asynchronous rule processing.',
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Prisma unique constraint violation (concurrent duplicate request race condition)
        fastify.log.info({ deliveryId }, 'Concurrent duplicate delivery caught by unique constraint.');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'duplicate_delivery',
          deliveryId,
        });
      }

      fastify.log.error({ err }, 'Failed to persist webhook event');
      return reply.status(500).send({ error: 'Failed to persist webhook event.' });
    }
  });

  /**
   * POST /webhooks/simulate
   * Development & testing helper to simulate incoming GitHub events directly
   */
  if (env.NODE_ENV !== 'production') {
    fastify.post<{
      Body: {
        eventType: string;
        action?: string;
        repositoryFullName: string;
        issueTitle?: string;
        issueBody?: string;
        issueNumber?: number;
      };
    }>('/webhooks/simulate', async (request, reply) => {
      const {
        eventType = 'issues',
        action = 'opened',
        repositoryFullName,
        issueTitle = 'Bug: test GitHub automation',
        issueBody = 'Steps to reproduce the crash...',
        issueNumber = 42,
      } = request.body || {};

      const deliveryId = `sim_${crypto.randomUUID()}`;

      // Find repository
      const repo = await prisma.repository.findFirst({
        where: { fullName: repositoryFullName },
      });

      const payload = {
        action,
        issue: {
          number: issueNumber,
          title: issueTitle,
          body: issueBody,
          user: { login: 'octocat' },
        },
        repository: {
          id: repo ? Number(repo.githubRepositoryId) : 101001,
          name: repo ? repo.name : 'project-a',
          full_name: repositoryFullName,
          owner: { login: repo ? repo.owner : 'developer' },
        },
      };

      const event = await prisma.gitHubEvent.create({
        data: {
          deliveryId,
          repositoryId: repo?.id || null,
          eventType,
          action,
          payload: payload as any,
          status: 'PENDING',
          receivedAt: new Date(),
        },
      });

      // Synchronously process for testing visibility
      await EventProcessor.processEvent(event.id);

      const processedEvent = await prisma.gitHubEvent.findUnique({
        where: { id: event.id },
        include: { actions: true },
      });

      return reply.send({
        success: true,
        event: processedEvent,
      });
    });
  }
};
