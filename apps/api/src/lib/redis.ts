import { Redis } from 'ioredis';
import { env } from '../config/env.js';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Évite qu’une coupure Redis ne terminates le processus via un EventEmitter non écouté.
redis.on('error', () => undefined);

let connectionPromise: Promise<void> | null = null;

export async function ensureRedisConnection(): Promise<void> {
  if (redis.status === 'ready') return;
  if (redis.status === 'connecting') {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => { cleanup(); resolve(); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { redis.off('ready', onReady); redis.off('error', onError); };
      redis.once('ready', onReady);
      redis.once('error', onError);
    });
    return;
  }
  if (!connectionPromise) {
    connectionPromise = redis.connect().then(() => undefined).finally(() => { connectionPromise = null; });
  }
  await connectionPromise;
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'end') return;
  if (redis.status === 'wait') {
    redis.disconnect();
    return;
  }
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
