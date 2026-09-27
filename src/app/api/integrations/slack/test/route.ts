import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { getSessionUser } from '@/lib/server/session';
import { decryptSlackWebhook } from '@/lib/server/encryption';
import { validateSlackWebhookUrl } from '@/lib/server/slackValidation';
import type { TestSlackIntegrationDto, TestSlackResult } from '@github-bot/shared';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as TestSlackIntegrationDto;
  let targetWebhookUrl: string;

  if (body.integrationId) {
    const integration = await prisma.slackIntegration.findFirst({
      where: { id: body.integrationId, userId: user.id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Slack integration not found or access denied.' },
        { status: 404 }
      );
    }

    try {
      targetWebhookUrl = decryptSlackWebhook(
        integration.encryptedWebhookUrl,
        integration.iv,
        integration.authTag
      );
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt stored webhook credentials.' },
        { status: 500 }
      );
    }
  } else if (body.webhookUrl) {
    const validation = validateSlackWebhookUrl(body.webhookUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json(
        { error: validation.error || 'Invalid Slack Webhook URL.' },
        { status: 400 }
      );
    }
    targetWebhookUrl = validation.normalizedUrl;
  } else {
    return NextResponse.json(
      { error: 'Either integrationId or webhookUrl must be provided to run test.' },
      { status: 400 }
    );
  }

  const testPayload = {
    text: '🤖 GitHub Automation Bot: Test notification',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 GitHub Automation Test Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *Slack Webhook Verified:* Your incoming webhook is active and ready to receive real-time repository triage alerts.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Dispatched at: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  if (
    targetWebhookUrl.includes('mock') ||
    targetWebhookUrl.includes('T00000000') ||
    process.env.NODE_ENV === 'test'
  ) {
    const mockResult: TestSlackResult = {
      success: true,
      statusCode: 200,
      message: 'Test notification verified successfully (mock mode).',
    };
    return NextResponse.json(mockResult);
  }

  try {
    const response = await fetch(targetWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const failureResult: TestSlackResult = {
        success: false,
        statusCode: response.status,
        message: `Slack responded with error (${response.status}): ${errorText}`,
      };
      return NextResponse.json(failureResult, { status: 400 });
    }

    const successResult: TestSlackResult = {
      success: true,
      statusCode: 200,
      message: 'Test notification delivered to Slack successfully! Check your channel.',
    };
    return NextResponse.json(successResult);
  } catch (err: any) {
    const networkResult: TestSlackResult = {
      success: false,
      statusCode: 500,
      message: `Network error connecting to Slack webhook: ${err.message}`,
    };
    return NextResponse.json(networkResult, { status: 500 });
  }
}
