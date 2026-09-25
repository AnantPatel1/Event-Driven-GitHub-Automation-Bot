import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    console.log(`🚀 Automation Server running at http://localhost:${env.PORT}`);
    console.log(`🩺 Health check available at http://localhost:${env.PORT}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
