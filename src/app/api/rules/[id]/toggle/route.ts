import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.rule.findFirst({
    where: {
      id,
      repository: { userId: user.id },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found or access denied.' }, { status: 404 });
  }

  const updated = await prisma.rule.update({
    where: { id },
    data: { enabled: !existing.enabled },
  });

  return NextResponse.json({
    success: true,
    enabled: updated.enabled,
  });
}
