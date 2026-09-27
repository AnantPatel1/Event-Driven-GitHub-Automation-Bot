import crypto from 'node:crypto';
import { env } from './env';

const MASTER_SECRET = process.env.ENCRYPTION_KEY || env.SESSION_SECRET || 'github-automation-bot-default-master-key-32';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(MASTER_SECRET).digest();

export interface EncryptedWebhookResult {
  encryptedWebhookUrl: string;
  iv: string;
  authTag: string;
  webhookUrlMask: string;
}

/**
 * Masks a Slack Incoming Webhook URL to prevent secret leakage in logs, UI, and API responses.
 */
export function maskSlackWebhook(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parts.length >= 4 && parts[0] === 'services') {
      const team = parts[1].length > 4 ? `${parts[1].slice(0, 4)}...` : 'T...';
      const bot = parts[2].length > 4 ? `${parts[2].slice(0, 4)}...` : 'B...';
      const secret = parts[3].length > 4 ? `********${parts[3].slice(-4)}` : '********';
      return `https://${parsed.hostname}/services/${team}/${bot}/${secret}`;
    }

    if (parts.length >= 2) {
      return `https://${parsed.hostname}/${parts[0]}/.../********`;
    }

    return `https://${parsed.hostname}/********`;
  } catch {
    return 'https://hooks.slack.com/services/********';
  }
}

/**
 * Encrypts a Slack Webhook URL using AES-256-GCM.
 */
export function encryptSlackWebhook(rawUrl: string): EncryptedWebhookResult {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(rawUrl, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');
  const mask = maskSlackWebhook(rawUrl);

  return {
    encryptedWebhookUrl: encrypted,
    iv: ivHex,
    authTag,
    webhookUrlMask: mask,
  };
}

/**
 * Decrypts an encrypted Slack Webhook URL using AES-256-GCM.
 */
export function decryptSlackWebhook(
  encryptedWebhookUrl: string,
  iv: string,
  authTag: string
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encryptedWebhookUrl, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
