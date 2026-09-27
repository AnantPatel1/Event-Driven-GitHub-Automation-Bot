import { prisma } from './prisma';
import { evaluateRule } from './ruleEngine';
import { ActionExecutor, type ActionExecutionContext } from './actionExecutor';
import type { ActionDefinition } from '@github-bot/shared';
import { GeminiTriageService } from './geminiTriage';

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

      const issueOrPr = (payload.issue || payload.pull_request) as Record<string, unknown> | undefined;
      const issueOrPrNumber = (issueOrPr?.number || payload.number) as number | undefined;
      const title = (issueOrPr?.title || payload.title) as string | undefined;
      const repoPayload = payload.repository as Record<string, unknown> | undefined;
      const owner = (repo?.owner || (repoPayload?.owner as any)?.login || 'unknown') as string;
      const repoName = (repo?.name || repoPayload?.name || 'unknown') as string;
      const accessToken = repo?.user?.githubAccessToken || '';

      let aiTriageResult = null;
      if (title && (event.eventType === 'issues' || event.eventType === 'pull_request')) {
        try {
          const body = (issueOrPr?.body as string) || '';
          const author = ((issueOrPr?.user as any)?.login as string) || '';
          aiTriageResult = await GeminiTriageService.triage({
            title,
            body,
            eventType: event.eventType,
            author,
          });

          await prisma.botAction.create({
            data: {
              eventId: event.id,
              type: 'ai.triage',
              status: 'SUCCESS',
              details: aiTriageResult as any,
              attempts: 1,
            },
          });
        } catch (aiErr) {
          console.warn('AI Triage error:', aiErr);
        }
      }

      const context: ActionExecutionContext = {
        eventId: event.id,
        repositoryId: repo?.id,
        userId: repo?.userId || repo?.user?.id || null,
        owner,
        repo: repoName,
        issueOrPrNumber,
        title,
        eventType: event.eventType,
        accessToken,
        aiTriage: aiTriageResult || undefined,
      };

      let anyRuleMatched = false;

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
   * Enqueues event for asynchronous processing
   */
  static enqueue(eventId: string): void {
    setImmediate(() => {
      this.processEvent(eventId).catch((err) => {
        console.error(`Unhandled error processing queued event ${eventId}:`, err);
      });
    });
  }
}
