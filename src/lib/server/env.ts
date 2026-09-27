import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://postgres:postgres@localhost:5433/github_bot?schema=public'),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  APP_URL: z.string().optional(),
  WEBHOOK_PUBLIC_URL: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default(''),
  SESSION_SECRET: z.string().default('default_session_secret_at_least_32_chars_long_12345'),
  GEMINI_API_KEY: z.string().default(''),
  ENCRYPTION_KEY: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid server environment variables:', error.format());
  }
  parsedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/github_bot?schema=public',
    ...process.env,
  });
}

export const env: Env = parsedEnv;
