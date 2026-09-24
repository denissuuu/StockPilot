import type { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findActiveUser } from '../modules/auth/auth.service.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';
import type { AuthenticatedUser } from '../types/fastify.js';

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('authUser', null as unknown as AuthenticatedUser);
  app.decorate('authenticate', async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw unauthorized();
    const claims = await verifyAccessToken(token);
    const user = await findActiveUser(claims.sub!);
    if (!user || user.organizationId !== claims.organizationId || claims.companyId !== claims.organizationId) throw unauthorized('Session invalide');

    request.authUser = {
      id: user.id,
      organizationId: user.organizationId,
      companyId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      organization: user.organization,
    };
  });

  app.decorate('authorize', (roles: Role[]) => async (request) => {
    if (!request.authUser) throw unauthorized();
    if (roles.length > 0 && !roles.includes(request.authUser.role)) {
      throw forbidden('Rôle requis pour cette opération');
    }
  });
}
