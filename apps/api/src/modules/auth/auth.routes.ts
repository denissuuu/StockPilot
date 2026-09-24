import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validation.js';
import { sendData } from '../../lib/response.js';
import { unauthorized } from '../../lib/errors.js';
import { REFRESH_COOKIE, clearRefreshCookie, issueTokens, revokeRefreshToken, rotateRefreshToken } from './token.service.js';
import { authenticate, register, toSessionUser } from './auth.service.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import { openApiProtected, openApiPublic } from '../../openapi.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['Authentification'],
        summary: 'Créer une organisation et son administrateur',
        ...openApiPublic,
        body: {
          type: 'object',
          required: ['organizationName', 'firstName', 'lastName', 'email', 'password'],
          properties: {
            organizationName: { type: 'string', minLength: 2 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            timezone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = parse(registerSchema, request.body);
      const result = await register(input);
      const { accessToken, expiresIn } = await issueTokens(toSessionUser(result.user), reply);
      return sendData(reply, { user: serializeUser(result.user), accessToken, expiresIn }, 201);
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Authentification'],
        summary: 'Ouvrir une session',
        ...openApiPublic,
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = parse(loginSchema, request.body);
      const result = await authenticate(input);
      const { accessToken, expiresIn } = await issueTokens(toSessionUser(result.user), reply);
      return sendData(reply, { user: serializeUser(result.user), accessToken, expiresIn });
    },
  );

  app.post(
    '/refresh',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Authentification'],
        summary: 'Rafraîchir la session avec rotation du refresh token',
        ...openApiPublic,
        body: {
          type: 'object',
          properties: { refreshToken: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const input = parse(refreshSchema, request.body ?? {});
      const token = input.refreshToken ?? request.cookies[REFRESH_COOKIE];
      if (!token) throw unauthorized('Refresh token manquant');
      const { accessToken, expiresIn } = await rotateRefreshToken(token, reply);
      return sendData(reply, { accessToken, expiresIn });
    },
  );

  app.post(
    '/logout',
    { schema: { tags: ['Authentification'], summary: 'Révoquer la session', ...openApiPublic } },
    async (request, reply) => {
      const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
      const token = body.refreshToken ?? request.cookies[REFRESH_COOKIE];
      await revokeRefreshToken(token);
      clearRefreshCookie(reply);
      return sendData(reply, { revoked: true });
    },
  );

  app.get(
    '/me',
    { preHandler: [app.authenticate], schema: { tags: ['Authentification'], summary: 'Profil courant', ...openApiProtected } },
    async (request, reply) => sendData(reply, serializeUser(request.authUser)),
  );
}

function serializeUser(user: {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  organization?: { id: string; name: string; currency: string; timezone: string };
}): Record<string, unknown> {
  return {
    id: user.id,
    organizationId: user.organizationId,
    companyId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive ?? true,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt?.toISOString() ?? null,
    updatedAt: user.updatedAt?.toISOString() ?? null,
    organization: user.organization,
  };
}
