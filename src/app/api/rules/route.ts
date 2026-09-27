import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import type { CreateRuleDto, RuleItem } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rules = await prisma.rule.findMany({
    where: {
      repository: {
        userId: user.id,
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

  const items: RuleItem[] = rules.map((r) => ({
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

  return NextResponse.json({ rules: items });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateRuleDto;
  const { repositoryId, eventType, conditions, actions, enabled = true } = body;

  if (!repositoryId || !eventType) {
    return NextResponse.json(
      { error: 'repositoryId and eventType are required.' },
      { status: 400 }
    );
  }

  const repository = await prisma.repository.findFirst({
    where: {
      id: repositoryId,
      userId: user.id,
    },
  });

  if (!repository) {
    return NextResponse.json(
      { error: 'Repository not found or access denied.' },
      { status: 404 }
    );
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

  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
