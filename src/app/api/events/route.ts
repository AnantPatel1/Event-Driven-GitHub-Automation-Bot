import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import type { GitHubEventItem } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageStr = searchParams.get('page');
  const limitStr = searchParams.get('limit');
  const status = searchParams.get('status');

  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || '15', 10) || 15));
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { repository: { userId: user.id } },
      { repositoryId: null },
    ],
    ...(status && status !== 'all' ? { status } : {}),
  };

  const userEventsWhere = {
    OR: [
      { repository: { userId: user.id } },
      { repositoryId: null },
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

  const items: GitHubEventItem[] = events.map((e) => ({
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
    actions: e.actions.map((a) => ({
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

  return NextResponse.json({
    events: items,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      totalActions,
    },
  });
}
