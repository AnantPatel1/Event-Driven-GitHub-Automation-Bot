import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { encryptSlackWebhook, decryptSlackWebhook } from '../lib/encryption.js';
import { validateSlackWebhookUrl } from '../lib/slackValidation.js';
import type {
  SlackIntegrationItem,
  SaveSlackIntegrationDto,
  TestSlackIntegrationDto,
  TestSlackResult,
} from '@github-bot/shared';

export const integrationsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /integrations/slack
   * Returns all Slack integrations configured by the authenticated user (with masked webhook URLs).
   */
  fastify.get('/integrations/slack', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    const integrations = await prisma.slackIntegration.findMany({
      where: { userId },
      include: { repository: true },
      orderBy: { createdAt: 'desc' },
    });

    const items: SlackIntegrationItem[] = integrations.map((item) => ({
      id: item.id,
      userId: item.userId,
      repositoryId: item.repositoryId,
      repositoryName: item.repository?.fullName || null,
      channelName: item.channelName,
      webhookUrlMask: item.webhookUrlMask,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return reply.send({ integrations: items });
  });

  /**
   * POST /integrations/slack
   * Encrypts and saves/updates a Slack incoming webhook integration for a user/repository.
   */
  fastify.post('/integrations/slack', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as SaveSlackIntegrationDto;

    if (!body || !body.webhookUrl) {
      return reply.status(400).send({ error: 'Webhook URL is required.' });
    }

    // SSRF & URL structure validation
    const validation = validateSlackWebhookUrl(body.webhookUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return reply.status(400).send({ error: validation.error || 'Invalid Slack Webhook URL.' });
    }

    // Validate repository scope if specified
    let targetRepoId: string | null = null;
    let repoName: string | null = null;

    if (body.repositoryId) {
      const repo = await prisma.repository.findFirst({
        where: {
          id: body.repositoryId,
          userId,
        },
      });

      if (!repo) {
        return reply.status(404).send({
          error: 'Repository not found or access denied in authenticated user scope.',
        });
      }
      targetRepoId = repo.id;
      repoName = repo.fullName;
    }

    // Encrypt webhook at rest
    const encrypted = encryptSlackWebhook(validation.normalizedUrl);

    // Upsert integration
    const existing = await prisma.slackIntegration.findFirst({
      where: {
        userId,
        repositoryId: targetRepoId,
      },
    });

    let savedItem;
    if (existing) {
      savedItem = await prisma.slackIntegration.update({
        where: { id: existing.id },
        data: {
          encryptedWebhookUrl: encrypted.encryptedWebhookUrl,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          webhookUrlMask: encrypted.webhookUrlMask,
          channelName: body.channelName?.trim() || null,
        },
      });
    } else {
      savedItem = await prisma.slackIntegration.create({
        data: {
          userId,
          repositoryId: targetRepoId,
          encryptedWebhookUrl: encrypted.encryptedWebhookUrl,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          webhookUrlMask: encrypted.webhookUrlMask,
          channelName: body.channelName?.trim() || null,
        },
      });
    }

    const responseItem: SlackIntegrationItem = {
      id: savedItem.id,
      userId: savedItem.userId,
      repositoryId: savedItem.repositoryId,
      repositoryName: repoName,
      channelName: savedItem.channelName,
      webhookUrlMask: savedItem.webhookUrlMask,
      createdAt: savedItem.createdAt,
      updatedAt: savedItem.updatedAt,
    };

    return reply.status(200).send({
      success: true,
      integration: responseItem,
      message: 'Slack integration saved and encrypted successfully.',
    });
  });

  /**
   * POST /integrations/slack/test
   * Dispatches an actual test notification to Slack and returns the delivery outcome.
   */
  fastify.post('/integrations/slack/test', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const body = (request.body || {}) as TestSlackIntegrationDto;

    let targetWebhookUrl: string;

    if (body.integrationId) {
      // Test existing stored integration
      const integration = await prisma.slackIntegration.findFirst({
        where: { id: body.integrationId, userId },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Slack integration not found or access denied.',
        });
      }

      try {
        targetWebhookUrl = decryptSlackWebhook(
          integration.encryptedWebhookUrl,
          integration.iv,
          integration.authTag
        );
      } catch {
        return reply.status(500).send({
          error: 'Failed to decrypt stored webhook credentials.',
        });
      }
    } else if (body.webhookUrl) {
      // Test URL before saving
      const validation = validateSlackWebhookUrl(body.webhookUrl);
      if (!validation.valid || !validation.normalizedUrl) {
        return reply.status(400).send({
          error: validation.error || 'Invalid Slack Webhook URL.',
        });
      }
      targetWebhookUrl = validation.normalizedUrl;
    } else {
      return reply.status(400).send({
        error: 'Either integrationId or webhookUrl must be provided to run test.',
      });
    }

    // Build formatted Slack test payload
    const testPayload = {
      text: '🤖 GitHub Automation Bot: Test notification',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤖 GitHub Automation Test Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *Slack Webhook Verified:* Your incoming webhook is active and ready to receive real-time repository triage alerts.',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Dispatched at: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    // If mock token or offline test environment
    if (
      targetWebhookUrl.includes('mock') ||
      targetWebhookUrl.includes('T00000000') ||
      process.env.NODE_ENV === 'test'
    ) {
      const mockResult: TestSlackResult = {
        success: true,
        statusCode: 200,
        message: 'Test notification verified successfully (mock mode).',
      };
      return reply.send(mockResult);
    }

    try {
      const response = await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const failureResult: TestSlackResult = {
          success: false,
          statusCode: response.status,
          message: `Slack responded with error (${response.status}): ${errorText}`,
        };
        return reply.status(400).send(failureResult);
      }

      const successResult: TestSlackResult = {
        success: true,
        statusCode: 200,
        message: 'Test notification delivered to Slack successfully! Check your channel.',
      };
      return reply.send(successResult);
    } catch (err: any) {
      const networkResult: TestSlackResult = {
        success: false,
        statusCode: 500,
        message: `Network error connecting to Slack webhook: ${err.message}`,
      };
      return reply.status(500).send(networkResult);
    }
  });

  /**
   * DELETE /integrations/slack/:id
   * Disconnects and deletes a user's Slack integration.
   */
  fastify.delete<{ Params: { id: string } }>(
    '/integrations/slack/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params;

      const integration = await prisma.slackIntegration.findFirst({
        where: { id, userId },
      });

      if (!integration) {
        return reply.status(404).send({
          error: 'Slack integration not found or access denied.',
        });
      }

      await prisma.slackIntegration.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Slack integration removed successfully.',
      });
    }
  );
};
