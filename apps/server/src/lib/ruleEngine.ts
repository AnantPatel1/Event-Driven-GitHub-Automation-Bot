import { RuleCondition, RuleConfig } from '@github-bot/shared';

/**
 * Extracts a value from a nested JSON payload using dot-notation (e.g., 'issue.title', 'pull_request.user.login')
 */
export function getNestedValue(payload: Record<string, unknown>, path: string): string | undefined {
  if (!payload || !path) return undefined;

  const parts = path.split('.');
  let current: unknown = payload;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) {
    return undefined;
  }

  return String(current);
}

/**
 * Evaluates whether a single condition matches against the webhook payload
 */
export function matchesCondition(condition: RuleCondition, payload: Record<string, unknown>): boolean {
  const actualValue = getNestedValue(payload, condition.field);
  if (actualValue === undefined) {
    return false;
  }

  const actual = actualValue.toLowerCase();
  const target = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return actual.includes(target);
    case 'equals':
      return actual === target;
    case 'starts_with':
      return actual.startsWith(target);
    default:
      return false;
  }
}

/**
 * Evaluates all conditions of a rule against the webhook payload.
 * Returns true if ALL conditions match (AND logic), or if no conditions are defined.
 */
export function evaluateRule(
  rule: {
    eventType: string;
    conditions: unknown;
    enabled: boolean;
  },
  eventType: string,
  payload: Record<string, unknown>
): boolean {
  if (!rule.enabled) {
    return false;
  }

  if (rule.eventType !== eventType) {
    return false;
  }

  const conditions = Array.isArray(rule.conditions) ? (rule.conditions as RuleCondition[]) : [];
  if (conditions.length === 0) {
    return true;
  }

  return conditions.every((cond) => matchesCondition(cond, payload));
}
