import { createHash, randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { ensureRedisConnection, redis } from '../../lib/redis.js';
import { unauthorized } from '../../lib/errors.js';
import { findActiveUser } from './auth.service.js';

export const REFRESH_COOKIE = 'stockpilot_refresh';
export const REFRESH_KEY_PREFIX = 'stockpilot:refresh:';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AccessClaims extends JWTPayload {
  type: 'access';
  organizationId: string;
  companyId: string;
  email: string;
  role: Role;
}

export interface RefreshClaims extends JWTPayload {
  type: 'refresh';
  organizationId: string;
  companyId: string;
  email: string;
  role: Role;
  jti: string;
}

export interface SessionUser {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function refreshKey(organizationId: string, jti: string): string {
  return `${REFRESH_KEY_PREFIX}${organizationId}:${jti}`;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TTL_SECONDS,
  };
}

export async function issueTokens(user: SessionUser, reply: FastifyReply): Promise<IssuedTokens> {
  const accessToken = await new SignJWT({
    type: 'access',
    organizationId: user.organizationId,
    companyId: user.organizationId,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessSecret);

  const jti = randomUUID();
  const refreshToken = await new SignJWT({
    type: 'refresh',
    organizationId: user.organizationId,
    companyId: user.organizationId,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${env.REFRESH_TTL_SECONDS}s`)
    .sign(refreshSecret);

  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  await ensureRedisConnection();
  await redis.set(
    refreshKey(user.organizationId, jti),
    JSON.stringify({ userId: user.id, email: user.email, role: user.role, companyId: user.organizationId, tokenHash }),
    'EX',
    env.REFRESH_TTL_SECONDS,
  );

  reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.organizationId !== 'string' ||
      typeof payload.companyId !== 'string' ||
      typeof payload.email !== 'string' ||
      !isRole(payload.role)
    ) {
      throw new Error('Invalid access claims');
    }
    return payload as AccessClaims;
  } catch {
    throw unauthorized('Token d’accès invalide ou expiré');
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret, { algorithms: ['HS256'] });
    if (
      payload.type !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.organizationId !== 'string' ||
      typeof payload.companyId !== 'string' ||
      typeof payload.email !== 'string' ||
      !isRole(payload.role)
    ) {
      throw new Error('Invalid refresh claims');
    }
    return payload as RefreshClaims;
  } catch {
    throw unauthorized('Refresh token invalide ou expiré');
  }
}

export async function rotateRefreshToken(token: string, reply: FastifyReply): Promise<IssuedTokens> {
  const claims = await verifyRefreshToken(token);
  const key = refreshKey(claims.organizationId, claims.jti);
  await ensureRedisConnection();
  const stored = await redis.get(key);
  if (!stored) {
    throw unauthorized('Session expirée ou révoquée');
  }

  let session: { userId?: string; email?: string; role?: Role; companyId?: string; tokenHash?: string };
  try {
    session = JSON.parse(stored) as { userId?: string; email?: string; role?: Role; companyId?: string; tokenHash?: string };
  } catch {
    await redis.del(key);
    throw unauthorized('Session invalide');
  }
  const presentedTokenHash = createHash('sha256').update(token).digest('hex');
  if (session.userId !== claims.sub || session.email !== claims.email || session.companyId !== claims.companyId || session.tokenHash !== presentedTokenHash) {
    await redis.del(key);
    throw unauthorized('Session révoquée');
  }

  const user = await findActiveUser(claims.sub!);
  if (!user || user.organizationId !== claims.organizationId || claims.companyId !== claims.organizationId) {
    await redis.del(key);
    throw unauthorized('Session révoquée');
  }

  // Rotation: l’ancien jeton est supprimé avant l’émission du nouveau.
  await redis.del(key);
  return issueTokens(
    {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    reply,
  );
}

export async function revokeRefreshToken(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    const claims = await verifyRefreshToken(token);
    await ensureRedisConnection();
    await redis.del(refreshKey(claims.organizationId, claims.jti));
  } catch {
    // La suppression d’un cookie déjà expiré est idempotente.
  }
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}

function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'MANAGER' || value === 'EMPLOYEE' || value === 'VIEWER';
}
