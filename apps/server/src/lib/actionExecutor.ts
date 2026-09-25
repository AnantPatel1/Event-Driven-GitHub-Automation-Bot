import { ActionDefinition } from '@github-bot/shared';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

export interface ActionExecutionContext {
  eventId: string;
  repositoryId?: string | null;
  owner: string;
  repo: string;
  issueOrPrNumber?: number;
  title?: string;
  eventType: string;
  accessToken: string;
}

export class ActionExecutor {
  /**
   * Executes a downstream action with exponential backoff retries
   */
  static async executeAction(
    action: ActionDefinition,
    context: ActionExecutionContext
  ): Promise<void> {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;
    let isSuccess = false;
    let details: Record<string, unknown> = {};

    while (attempt < maxAttempts && !isSuccess) {
      attempt++;
      try {
        switch (action.type) {
          case 'github.add_label':
            details = await this.addGitHubLabel(action.label || 'bug', context);
            break;

          case 'github.comment':
            details = await this.addGitHubComment(
              action.comment || 'Automated response from GitHub Bot.',
              context
            );
            break;

          case 'slack.notify':
            details = await this.sendSlackNotification(action.message, context);
            break;

          default:
            throw new Error(`Unsupported action type: ${(action as any).type}`);
        }
        isSuccess = true;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `⚠️ Action ${action.type} attempt ${attempt} failed: ${lastError.message}`
        );

        // Do not retry permanent client errors (e.g. 401, 404)
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('404') ||
          lastError.message.includes('Unsupported')
        ) {
          break;
        }

        if (attempt < maxAttempts) {
          // Bounded exponential backoff: 1s, 5s
          const backoffMs = attempt === 1 ? 1000 : 5000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Persist action execution audit log in PostgreSQL
    await prisma.botAction.create({
      data: {
        eventId: context.eventId,
        type: action.type,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        details: (isSuccess ? details : { error: lastError?.message }) as any,
        error: isSuccess ? null : lastError?.message,
        attempts: attempt,
      },
    });

    if (!isSuccess && lastError) {
      throw lastError;
    }
  }

  /**
   * Adds a label to an Issue or Pull Request via GitHub REST API
   */
  private static async addGitHubLabel(
    label: string,
    context: ActionExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!context.issueOrPrNumber) {
      throw new Error('Cannot add label: No issue or pull request number found in event payload.');
    }

    if (context.accessToken.startsWith('gho_mock_') || !context.accessToken) {
      // Mock execution for offline / test environments
      console.log(`🏷️ [MOCK] Added label "${label}" to ${context.owner}/${context.repo}#${context.issueOrPrNumber}`);
      return { mock: true, label, issueNumber: context.issueOrPrNumber };
    }

    const endpoint = `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.issueOrPrNumber}/labels`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
      body: JSON.stringify({
        labels: [label],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub add_label failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return { label, result };
  }

  /**
   * Posts a comment to an Issue or Pull Request via GitHub REST API
   */
  private static async addGitHubComment(
    body: string,
    context: ActionExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!context.issueOrPrNumber) {
      throw new Error('Cannot add comment: No issue or pull request number found in event payload.');
    }

    if (context.accessToken.startsWith('gho_mock_') || !context.accessToken) {
      console.log(`💬 [MOCK] Added comment to ${context.owner}/${context.repo}#${context.issueOrPrNumber}: ${body}`);
      return { mock: true, comment: body, issueNumber: context.issueOrPrNumber };
    }

    const endpoint = `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.issueOrPrNumber}/comments`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub add_comment failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return { comment: body, result };
  }

  /**
   * Posts an operational notification to Slack via Incoming Webhook
   */
  private static async sendSlackNotification(
    customMessage: string | undefined,
    context: ActionExecutionContext
  ): Promise<Record<string, unknown>> {
    const slackUrl = env.SLACK_WEBHOOK_URL;

    const fallbackText = `🤖 GitHub Automation\nRepository: ${context.owner}/${context.repo}\nIssue: #${context.issueOrPrNumber || 'N/A'}\nTitle: ${context.title || 'N/A'}\n${customMessage ? `Note: ${customMessage}` : ''}`;

    const slackPayload = {
      text: fallbackText,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤖 GitHub Automation Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Repository:*\n\`${context.owner}/${context.repo}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Item:*\n#${context.issueOrPrNumber || 'N/A'} (${context.eventType})`,
            },
            {
              type: 'mrkdwn',
              text: `*Title:*\n${context.title || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nAction processed successfully`,
            },
          ],
        },
        ...(customMessage
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Details:* ${customMessage}`,
                },
              },
            ]
          : []),
      ],
    };

    if (!slackUrl || slackUrl.includes('placeholder') || slackUrl.includes('mock')) {
      console.log('📣 [SLACK MOCK] Webhook notification dispatched:\n', fallbackText);
      return { mock: true, payload: slackPayload };
    }

    const response = await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack webhook notification failed (${response.status}): ${errorText}`);
    }

    return { delivered: true, timestamp: new Date().toISOString() };
  }
}
