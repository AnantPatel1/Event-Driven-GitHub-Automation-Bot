import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root or local .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  WEBHOOK_PUBLIC_URL: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default(''),
  SESSION_SECRET: z.string().default('default_session_secret_at_least_32_chars_long_12345'),
  GEMINI_API_KEY: z.string().default(''),
  ENCRYPTION_KEY: z.string().default(''),
  APP_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:', error.format());
  }
  parsedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/github_bot?schema=public',
    ...process.env,
  });
}

export const env: Env = parsedEnv;

