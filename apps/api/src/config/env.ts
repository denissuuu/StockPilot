import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://stockpilot:stockpilot@localhost:5432/stockpilot?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('development-access-secret-change-me-please-32chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('development-refresh-secret-change-me-please-32chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  COOKIE_SECURE: booleanFromEnv,
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuration invalide', parsed.error.flatten().fieldErrors);
  throw new Error('Configuration invalide');
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const insecureSecrets = new Set([
    'development-access-secret-change-me-please-32chars',
    'development-refresh-secret-change-me-please-32chars',
    'replace-this-access-secret-with-at-least-32-characters',
    'replace-this-refresh-secret-with-at-least-32-characters',
  ]);
  if (insecureSecrets.has(env.JWT_ACCESS_SECRET) || insecureSecrets.has(env.JWT_REFRESH_SECRET)) {
    throw new Error('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être remplacés en production');
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('Les secrets JWT access et refresh doivent être différents');
  }
}

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
