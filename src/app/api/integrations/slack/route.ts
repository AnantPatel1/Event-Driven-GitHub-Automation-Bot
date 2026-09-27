import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import { encryptSlackWebhook } from '@/lib/server/encryption';
import { validateSlackWebhookUrl } from '@/lib/server/slackValidation';
import type { SlackIntegrationItem, SaveSlackIntegrationDto } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const integrations = await prisma.slackIntegration.findMany({
    where: { userId: user.id },
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

  return NextResponse.json({ integrations: items });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SaveSlackIntegrationDto;
  if (!body || !body.webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL is required.' }, { status: 400 });
  }

  const validation = validateSlackWebhookUrl(body.webhookUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return NextResponse.json(
      { error: validation.error || 'Invalid Slack Webhook URL.' },
      { status: 400 }
    );
  }

  let targetRepoId: string | null = null;
  let repoName: string | null = null;

  if (body.repositoryId) {
    const repo = await prisma.repository.findFirst({
      where: {
        id: body.repositoryId,
        userId: user.id,
      },
    });

    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found or access denied in authenticated user scope.' },
        { status: 404 }
      );
    }
    targetRepoId = repo.id;
    repoName = repo.fullName;
  }

  const encrypted = encryptSlackWebhook(validation.normalizedUrl);

  const existing = await prisma.slackIntegration.findFirst({
    where: {
      userId: user.id,
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
        userId: user.id,
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

  return NextResponse.json({
    success: true,
    integration: responseItem,
    message: 'Slack integration saved and encrypted successfully.',
  });
}
