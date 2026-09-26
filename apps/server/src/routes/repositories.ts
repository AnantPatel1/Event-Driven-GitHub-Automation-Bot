import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { GitHubService } from '../lib/github.js';
import { RepositoryItem } from '@github-bot/shared';

interface DbLocalRepo {
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  webhookId: string | null;
  createdAt: Date;
  _count: {
    rules: number;
  };
}

interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
  };
}

export const repositoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /repositories
   * Returns list of GitHub repositories accessible by the authenticated user,
   * annotated with local connection status, webhook status, and rules count.
   */
  fastify.get('/repositories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    // Retrieve user and token from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubUsername: true,
        githubAccessToken: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found in system.' });
    }

    try {
      // 1. Fetch accessible repos from GitHub
      const ghRepos = await GitHubService.getUserRepositories(
        user.githubAccessToken,
        user.githubUsername
      );

      // 2. Fetch locally connected repos for this user from PostgreSQL
      const localRepos = await prisma.repository.findMany({
        where: { userId: user.id },
        include: {
          _count: {
            select: { rules: true },
          },
        },
      });

      const localMap = new Map((localRepos as DbLocalRepo[]).map((lr: DbLocalRepo) => [lr.githubRepositoryId, lr]));

      // 3. Annotate repositories with connection state
      const repositories: RepositoryItem[] = (ghRepos as GitHubRepoItem[]).map((gh: GitHubRepoItem) => {
        const local = localMap.get(String(gh.id));
        return {
          id: local?.id,
          githubRepositoryId: String(gh.id),
          owner: gh.owner.login,
          name: gh.name,
          fullName: gh.full_name,
          description: gh.description,
          isPrivate: gh.private,
          defaultBranch: gh.default_branch,
          isConnected: !!local,
          webhookId: local?.webhookId || null,
          ruleCount: local?._count.rules || 0,
          createdAt: local?.createdAt,
        };
      });

      return reply.send({ repositories });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch repositories for user');
      return reply.status(500).send({
        error: 'Unable to retrieve repositories from GitHub API.',
      });
    }
  });

  /**
   * POST /repositories/:id/connect
   * Connects a GitHub repository:
   * 1. Verifies user ownership/authorization
   * 2. Registers GitHub webhook (issues, pull_request)
   * 3. Persists repository to PostgreSQL
   */
  fastify.post<{
    Params: { id: string };
  }>('/repositories/:id/connect', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const repoIdentifier = request.params.id;

    if (!repoIdentifier) {
      return reply.status(400).send({ error: 'Repository identifier is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubUsername: true,
        githubAccessToken: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Authenticated user not found.' });
    }

    try {
      // Step 1: Verify the repository belongs to/is accessible with admin rights by the user
      const repoData = await GitHubService.getAndVerifyRepository(
        user.githubAccessToken,
        repoIdentifier,
        user.githubUsername
      );

      // Step 2: Configure webhook URL and secret (supports public tunnels like ngrok)
      const webhookBase = env.WEBHOOK_PUBLIC_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const webhookUrl = `${webhookBase}/webhooks/github`;
      const webhookSecret = env.GITHUB_WEBHOOK_SECRET || 'development_webhook_secret_key_32chars';

      // Step 3: Create GitHub webhook
      const webhookId = await GitHubService.createWebhook(
        user.githubAccessToken,
        repoData.owner.login,
        repoData.name,
        webhookUrl,
        webhookSecret
      );

      // Step 4: Persist repository in PostgreSQL
      const repository = await prisma.repository.upsert({
        where: {
          userId_githubRepositoryId: {
            userId: user.id,
            githubRepositoryId: String(repoData.id),
          },
        },
        update: {
          owner: repoData.owner.login,
          name: repoData.name,
          fullName: repoData.full_name,
          webhookId,
        },
        create: {
          userId: user.id,
          githubRepositoryId: String(repoData.id),
          owner: repoData.owner.login,
          name: repoData.name,
          fullName: repoData.full_name,
          webhookId,
        },
      });

      return reply.send({
        success: true,
        message: `Successfully connected ${repository.fullName}`,
        repository: {
          id: repository.id,
          githubRepositoryId: repository.githubRepositoryId,
          owner: repository.owner,
          name: repository.name,
          fullName: repository.fullName,
          webhookId: repository.webhookId,
          ruleCount: 0,
          createdAt: repository.createdAt,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect repository';
      fastify.log.error({ err }, 'Error connecting repository');
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * DELETE /repositories/:id/disconnect
   * Disconnects a repository:
   * 1. Verifies requesting user owns this repository record in the system
   * 2. Deletes the GitHub webhook
   * 3. Removes repository from PostgreSQL
   */
  fastify.delete<{
    Params: { id: string };
  }>('/repositories/:id/disconnect', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const repoIdentifier = request.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubUsername: true,
        githubAccessToken: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Authenticated user not found.' });
    }

    // Authorization check: Verify user owns the target repository
    const repository = await prisma.repository.findFirst({
      where: {
        userId: user.id,
        OR: [{ id: repoIdentifier }, { githubRepositoryId: repoIdentifier }],
      },
    });

    if (!repository) {
      return reply.status(404).send({
        error: 'Repository not found or you do not have permission to disconnect it.',
      });
    }

    try {
      // Delete webhook from GitHub if webhookId is recorded
      if (repository.webhookId) {
        await GitHubService.deleteWebhook(
          user.githubAccessToken,
          repository.owner,
          repository.name,
          repository.webhookId
        );
      }

      // Remove from PostgreSQL
      await prisma.repository.delete({
        where: { id: repository.id },
      });

      return reply.send({
        success: true,
        message: `Repository ${repository.fullName} disconnected successfully.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect repository';
      fastify.log.error({ err }, 'Error disconnecting repository');
      return reply.status(500).send({ error: message });
    }
  });
};
