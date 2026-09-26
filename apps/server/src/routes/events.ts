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
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
    };
  }>('/events', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const { page: pageStr, limit: limitStr, status } = request.query;

    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '15', 10) || 15));
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { repository: { userId } },
        { repositoryId: null }, // System or unmatched events
      ],
      ...(status && status !== 'all' ? { status } : {}),
    };

    const userEventsWhere = {
      OR: [
        { repository: { userId } },
        { repositoryId: null }, // System or unmatched events
      ],
    };

    const [events, totalCount, totalActions] = await Promise.all([
      prisma.gitHubEvent.findMany({
        where,
        include: {
          repository: {
            select: { fullName: true },
          },
          actions: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gitHubEvent.count({ where }),
      prisma.botAction.count({
        where: {
          event: userEventsWhere,
        },
      }),
    ]);

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

    return reply.send({
      events: items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
        totalActions,
      },
    });
  });
};
