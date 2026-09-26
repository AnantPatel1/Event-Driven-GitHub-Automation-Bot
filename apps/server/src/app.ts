import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { repositoryRoutes } from './routes/repositories.js';
import { webhookRoutes } from './routes/webhooks.js';
import { ruleRoutes } from './routes/rules.js';
import { eventRoutes } from './routes/events.js';
import { integrationsRoutes } from './routes/integrations.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
    trustProxy: true,
  });

  // Preserve raw request body buffer for HMAC-SHA256 webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      (req as any).rawBody = body;
      const json = JSON.parse(body.toString('utf8'));
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Security and utilities
  await app.register(sensible);
  await app.register(cors, {
    origin: [env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  });
  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  });

  // Authentication plugin
  await app.register(authPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(repositoryRoutes);
  await app.register(webhookRoutes);
  await app.register(ruleRoutes);
  await app.register(eventRoutes);
  await app.register(integrationsRoutes);

  // Root welcome / info route
  app.get('/', async () => {
    return {
      name: 'GitHub Automation Bot API',
      version: '1.0.0',
      status: 'online',
      endpoints: {
        health: '/health',
      },
    };
  });

  return app;
}
