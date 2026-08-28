import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

async function main() {
  // Fail fast if the DB is unreachable.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('Fatal startup error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
