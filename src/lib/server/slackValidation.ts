/**
 * Validates Slack Incoming Webhook URLs and prevents Server-Side Request Forgery (SSRF)
 */

export interface SlackValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

export function validateSlackWebhookUrl(rawUrl: string): SlackValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Webhook URL is required.' };
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length > 500) {
    return { valid: false, error: 'Webhook URL exceeds maximum length (500 characters).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Enforce HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Webhook URL must use HTTPS protocol.' };
  }

  // Prevent credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL must not contain embedded user credentials.' };
  }

  // Prevent non-standard ports
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: 'URL must use the default HTTPS port.' };
  }

  // Strict Hostname check: MUST be hooks.slack.com
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'hooks.slack.com') {
    return {
      valid: false,
      error: `Invalid hostname "${hostname}". Slack Webhooks must point directly to hooks.slack.com to prevent SSRF.`,
    };
  }

  // Strict path structure check: /services/T.../B.../... or /workflows/...
  const pathname = parsed.pathname;
  const isServicesWebhook = /^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(pathname);
  const isWorkflowWebhook = /^\/workflows\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(pathname);

  if (!isServicesWebhook && !isWorkflowWebhook) {
    return {
      valid: false,
      error: 'Invalid Slack webhook path structure. Must follow https://hooks.slack.com/services/T.../B.../...',
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}
