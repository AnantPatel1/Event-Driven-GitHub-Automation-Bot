import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import { GitHubService } from '@/lib/server/github';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: repoIdentifier } = await context.params;

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

  const repository = await prisma.repository.findFirst({
    where: {
      userId: dbUser.id,
      OR: [{ id: repoIdentifier }, { githubRepositoryId: repoIdentifier }],
    },
  });

  if (!repository) {
    return NextResponse.json(
      { error: 'Repository not found or you do not have permission to disconnect it.' },
      { status: 404 }
    );
  }

  try {
    if (repository.webhookId) {
      await GitHubService.deleteWebhook(
        dbUser.githubAccessToken,
        repository.owner,
        repository.name,
        repository.webhookId
      );
    }

    await prisma.repository.delete({
      where: { id: repository.id },
    });

    return NextResponse.json({
      success: true,
      message: `Repository ${repository.fullName} disconnected successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect repository';
    console.error('Error disconnecting repository:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
