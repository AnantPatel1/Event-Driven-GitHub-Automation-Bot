import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const integration = await prisma.slackIntegration.findFirst({
    where: { id, userId: user.id },
  });

  if (!integration) {
    return NextResponse.json(
      { error: 'Slack integration not found or access denied.' },
      { status: 404 }
    );
  }

  await prisma.slackIntegration.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
    message: 'Slack integration removed successfully.',
  });
}
