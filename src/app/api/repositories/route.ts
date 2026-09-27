import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import { GitHubService } from '@/lib/server/github';
import type { RepositoryItem } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ error: 'User not found in system.' }, { status: 401 });
  }

  try {
    const ghRepos = await GitHubService.getUserRepositories(
      dbUser.githubAccessToken,
      dbUser.githubUsername
    );

    const localRepos = await prisma.repository.findMany({
      where: { userId: dbUser.id },
      include: {
        _count: {
          select: { rules: true },
        },
      },
    });

    const localMap = new Map(localRepos.map((lr) => [lr.githubRepositoryId, lr]));

    const repositories: RepositoryItem[] = ghRepos.map((gh) => {
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

    return NextResponse.json({ repositories });
  } catch (err: any) {
    console.error('Failed to fetch repositories for user:', err);
    return NextResponse.json(
      { error: 'Unable to retrieve repositories from GitHub API.' },
      { status: 500 }
    );
  }
}
