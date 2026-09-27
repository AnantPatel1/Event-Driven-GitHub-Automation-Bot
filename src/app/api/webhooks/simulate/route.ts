import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { EventProcessor } from '@/lib/server/eventProcessor';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      eventType = 'issues',
      action = 'opened',
      repositoryFullName,
      issueTitle = 'Bug: test GitHub automation',
      issueBody = 'Steps to reproduce the crash...',
      issueNumber = 42,
    } = body;

    const deliveryId = `sim_${crypto.randomUUID()}`;

    const repo = await prisma.repository.findFirst({
      where: { fullName: repositoryFullName },
    });

    const payload = {
      action,
      issue: {
        number: issueNumber,
        title: issueTitle,
        body: issueBody,
        user: { login: 'octocat' },
      },
      repository: {
        id: repo ? Number(repo.githubRepositoryId) : 101001,
        name: repo ? repo.name : 'project-a',
        full_name: repositoryFullName,
        owner: { login: repo ? repo.owner : 'developer' },
      },
    };

    const event = await prisma.gitHubEvent.create({
      data: {
        deliveryId,
        repositoryId: repo?.id || null,
        eventType,
        action,
        payload: payload as any,
        status: 'PENDING',
        receivedAt: new Date(),
      },
    });

    // Synchronously process for testing visibility
    await EventProcessor.processEvent(event.id);

    const processedEvent = await prisma.gitHubEvent.findUnique({
      where: { id: event.id },
      include: { actions: true },
    });

    return NextResponse.json({
      success: true,
      event: processedEvent,
    });
  } catch (err: any) {
    console.error('Error simulating webhook:', err);
    return NextResponse.json({ error: err?.message || 'Simulation failed' }, { status: 500 });
  }
}
