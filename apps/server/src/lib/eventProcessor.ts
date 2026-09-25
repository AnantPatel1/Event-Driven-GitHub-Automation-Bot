import { prisma } from './prisma.js';
import { evaluateRule } from './ruleEngine.js';
import { ActionExecutor, ActionExecutionContext } from './actionExecutor.js';
import { ActionDefinition } from '@github-bot/shared';

export class EventProcessor {
  /**
   * Process a persisted GitHubEvent by evaluating rules and executing matching actions
   */
  static async processEvent(eventId: string): Promise<void> {
    try {
      const event = await prisma.gitHubEvent.findUnique({
        where: { id: eventId },
        include: {
          repository: {
            include: {
              user: true,
              rules: {
                where: { enabled: true },
              },
            },
          },
        },
      });

      if (!event) {
        console.warn(`Event ${eventId} not found for processing.`);
        return;
      }

      if (event.status === 'PROCESSED') {
        console.log(`Event ${eventId} already processed (idempotency guard).`);
        return;
      }

      const payload = event.payload as Record<string, unknown>;
      const rules = event.repository?.rules || [];
      const repo = event.repository;

      // Extract context details from payload
      const issueOrPr = (payload.issue || payload.pull_request) as Record<string, unknown> | undefined;
      const issueOrPrNumber = (issueOrPr?.number || payload.number) as number | undefined;
      const title = (issueOrPr?.title || payload.title) as string | undefined;
      const repoPayload = payload.repository as Record<string, unknown> | undefined;
      const owner = (repo?.owner || (repoPayload?.owner as any)?.login || 'unknown') as string;
      const repoName = (repo?.name || repoPayload?.name || 'unknown') as string;
      const accessToken = repo?.user?.githubAccessToken || '';

      const context: ActionExecutionContext = {
        eventId: event.id,
        repositoryId: repo?.id,
        owner,
        repo: repoName,
        issueOrPrNumber,
        title,
        eventType: event.eventType,
        accessToken,
      };

      let anyRuleMatched = false;

      // Evaluate rules
      for (const rule of rules) {
        const matches = evaluateRule(
          {
            eventType: rule.eventType,
            conditions: rule.conditions,
            enabled: rule.enabled,
          },
          event.eventType,
          payload
        );

        if (matches) {
          anyRuleMatched = true;
          const actions = Array.isArray(rule.actions) ? (rule.actions as unknown as ActionDefinition[]) : [];

          for (const action of actions) {
            try {
              await ActionExecutor.executeAction(action, context);
            } catch (actionErr) {
              console.error(`Error executing action ${action.type} for event ${event.id}:`, actionErr);
            }
          }
        }
      }

      // Mark event as processed
      await prisma.gitHubEvent.update({
        where: { id: event.id },
        data: {
          status: anyRuleMatched ? 'PROCESSED' : 'IGNORED',
          processedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`Error in event processing pipeline for event ${eventId}:`, err);
      await prisma.gitHubEvent.update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
        },
      }).catch(() => {});
    }
  }

  /**
   * Dispatches event for asynchronous processing without blocking the webhook response
   */
  static enqueue(eventId: string): void {
    setImmediate(() => {
      this.processEvent(eventId).catch((err) => {
        console.error(`Unhandled error processing queued event ${eventId}:`, err);
      });
    });
  }
}
