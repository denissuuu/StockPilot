import { buildApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

const app = await buildApp();

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Arrêt de StockPilot API');
  await app.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  process.exit(0);
};

process.once('SIGINT', () => void close('SIGINT'));
process.once('SIGTERM', () => void close('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await disconnectPrisma();
  await disconnectRedis();
  process.exit(1);
}
