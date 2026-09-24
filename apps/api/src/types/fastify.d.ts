import type { Role } from '@prisma/client';
import type { FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  organization: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: AuthenticatedUser;
  }
}
