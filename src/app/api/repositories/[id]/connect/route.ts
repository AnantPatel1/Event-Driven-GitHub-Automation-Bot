import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { env } from '@/lib/server/env';
import { getSessionUser } from '@/lib/server/session';
import { GitHubService } from '@/lib/server/github';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: repoIdentifier } = await context.params;
  if (!repoIdentifier) {
    return NextResponse.json({ error: 'Repository identifier is required.' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      githubUsername: true,
      githubAccessToken: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'Authenticated user not found.' }, { status: 401 });
  }

  try {
    const repoData = await GitHubService.getAndVerifyRepository(
      dbUser.githubAccessToken,
      repoIdentifier,
      dbUser.githubUsername
    );

    const requestUrl = new URL(request.url);
    const origin = env.APP_URL || env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
    const webhookBase = env.WEBHOOK_PUBLIC_URL || origin;
    const webhookUrl = `${webhookBase}/api/webhooks/github`;
    const webhookSecret = env.GITHUB_WEBHOOK_SECRET || 'development_webhook_secret_key_32chars';

    const webhookId = await GitHubService.createWebhook(
      dbUser.githubAccessToken,
      repoData.owner.login,
      repoData.name,
      webhookUrl,
      webhookSecret
    );

    const repository = await prisma.repository.upsert({
      where: {
        userId_githubRepositoryId: {
          userId: dbUser.id,
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
        userId: dbUser.id,
        githubRepositoryId: String(repoData.id),
        owner: repoData.owner.login,
        name: repoData.name,
        fullName: repoData.full_name,
        webhookId,
      },
    });

    return NextResponse.json({
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
    console.error('Error connecting repository:', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
