import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { CreateRuleDto, RuleItem } from '@github-bot/shared';

interface DbRuleWithRepo {
  id: string;
  repositoryId: string;
  repository: {
    fullName: string;
  };
  eventType: string;
  conditions: unknown;
  actions: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ruleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /rules
   * Returns all rules configured for the authenticated user's repositories
   */
  fastify.get('/rules', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    const rules = await prisma.rule.findMany({
      where: {
        repository: {
          userId,
        },
      },
      include: {
        repository: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: RuleItem[] = (rules as DbRuleWithRepo[]).map((r: DbRuleWithRepo) => ({
      id: r.id,
      repositoryId: r.repositoryId,
      repositoryName: r.repository.fullName,
      eventType: r.eventType as any,
      conditions: (r.conditions as any) || [],
      actions: (r.actions as any) || [],
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return reply.send({ rules: items });
  });

  /**
   * POST /rules
   * Creates a new automation rule for a repository
   */
  fastify.post<{
    Body: CreateRuleDto;
  }>('/rules', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const { repositoryId, eventType, conditions, actions, enabled = true } = request.body || {};

    if (!repositoryId || !eventType) {
      return reply.status(400).send({
        error: 'repositoryId and eventType are required.',
      });
    }

    // Verify requesting user owns the target repository
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        userId,
      },
    });

    if (!repository) {
      return reply.status(404).send({
        error: 'Repository not found or access denied.',
      });
    }

    const rule = await prisma.rule.create({
      data: {
        repositoryId,
        eventType,
        conditions: (conditions as any) || [],
        actions: (actions as any) || [],
        enabled,
      },
    });

    return reply.status(201).send({
      success: true,
      rule: {
        id: rule.id,
        repositoryId: rule.repositoryId,
        repositoryName: repository.fullName,
        eventType: rule.eventType,
        conditions: rule.conditions,
        actions: rule.actions,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    });
  });

  /**
   * PATCH /rules/:id/toggle
   * Toggles the enabled state of a rule
   */
  fastify.patch<{
    Params: { id: string };
  }>('/rules/:id/toggle', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;

    const existing = await prisma.rule.findFirst({
      where: {
        id,
        repository: { userId },
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Rule not found or access denied.' });
    }

    const updated = await prisma.rule.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });

    return reply.send({
      success: true,
      enabled: updated.enabled,
    });
  });

  /**
   * DELETE /rules/:id
   * Removes a rule
   */
  fastify.delete<{
    Params: { id: string };
  }>('/rules/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;

    const existing = await prisma.rule.findFirst({
      where: {
        id,
        repository: { userId },
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Rule not found or access denied.' });
    }

    await prisma.rule.delete({ where: { id } });

    return reply.send({
      success: true,
      message: 'Rule deleted successfully.',
    });
  });
};
