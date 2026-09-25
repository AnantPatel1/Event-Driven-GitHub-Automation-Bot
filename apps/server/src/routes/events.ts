import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { GitHubEventItem } from '@github-bot/shared';

interface DbAction {
  id: string;
  eventId: string;
  type: string;
  status: string;
  details: unknown;
  error: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DbEventWithRelations {
  id: string;
  deliveryId: string;
  repositoryId: string | null;
  repository: {
    fullName: string;
  } | null;
  eventType: string;
  action: string | null;
  status: string;
  receivedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  actions: DbAction[];
}

export const eventRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /events
   * Returns recent webhook events and associated bot actions for the user's repositories
   */
  fastify.get('/events', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    const events = await prisma.gitHubEvent.findMany({
      where: {
        OR: [
          { repository: { userId } },
          { repositoryId: null }, // System or unmatched events
        ],
      },
      include: {
        repository: {
          select: { fullName: true },
        },
        actions: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });

    const items: GitHubEventItem[] = (events as DbEventWithRelations[]).map((e: DbEventWithRelations) => ({
      id: e.id,
      deliveryId: e.deliveryId,
      repositoryId: e.repositoryId,
      repositoryName: e.repository?.fullName || 'External/Unknown',
      eventType: e.eventType,
      action: e.action,
      status: e.status as any,
      receivedAt: e.receivedAt,
      processedAt: e.processedAt,
      createdAt: e.createdAt,
      actions: e.actions.map((a: DbAction) => ({
        id: a.id,
        eventId: a.eventId,
        type: a.type as any,
        status: a.status as any,
        details: (a.details as any) || null,
        error: a.error,
        attempts: a.attempts,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    }));

    return reply.send({ events: items });
  });
};
