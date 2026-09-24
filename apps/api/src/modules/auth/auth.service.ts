import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { SessionUser } from './token.service.js';

export type AuthUser = User & {
  organization: { id: string; name: string; currency: string; timezone: string };
};

export interface AuthResult {
  user: AuthUser;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('Un compte existe déjà avec cette adresse email');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        currency: input.currency,
        timezone: input.timezone,
      },
    });
    return tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'ADMIN',
      },
      include: {
        organization: { select: { id: true, name: true, currency: true, timezone: true } },
      },
    });
  });

  return { user };
}

export async function authenticate(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      organization: { select: { id: true, name: true, currency: true, timezone: true } },
    },
  });
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  const lastLoginAt = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt } });
  return { user: { ...user, lastLoginAt } };
}

export async function findActiveUser(userId: string): Promise<(User & { organization: { id: string; name: string; currency: string; timezone: string } }) | null> {
  return prisma.user.findFirst({
    where: { id: userId, isActive: true },
    include: {
      organization: { select: { id: true, name: true, currency: true, timezone: true } },
    },
  });
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
