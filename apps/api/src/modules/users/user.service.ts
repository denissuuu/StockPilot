import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { revokeUserRefreshSessions } from '../auth/token.service.js';
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from './user.schemas.js';

export async function listUsers(organizationId: string, input: ListUsersInput) {
  const { skip, take } = pagination(input);
  const where: Prisma.UserWhereInput = {
    organizationId,
    ...(input.role ? { role: input.role } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? {
          OR: [
            { email: { contains: input.search, mode: 'insensitive' } },
            { firstName: { contains: input.search, mode: 'insensitive' } },
            { lastName: { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  return { users, meta: pageMeta(input, total) };
}

export async function getUser(organizationId: string, id: string) {
  const user = await prisma.user.findFirst({ where: { id, organizationId } });
  if (!user) throw notFound('Utilisateur');
  return user;
}

export async function createUser(
  organizationId: string,
  actorRole: Role,
  input: CreateUserInput,
) {
  assertCanAssignRole(actorRole, input.role);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('Un compte existe déjà avec cette adresse email');
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      organizationId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
  });
}

export async function updateUser(
  organizationId: string,
  id: string,
  actorId: string,
  actorRole: Role,
  input: UpdateUserInput,
) {
  const { password, ...data } = input;
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, organizationId } });
    if (!user) throw notFound('Utilisateur');
    assertCanManageUser(actorRole, user.role);
    if (input.role) assertCanAssignRole(actorRole, input.role);
    if (id === actorId && input.isActive === false) throw forbidden('Vous ne pouvez pas désactiver votre propre compte');
    if (id === actorId && input.role && input.role !== user.role) {
      throw forbidden('Vous ne pouvez pas modifier votre propre rôle');
    }
    if (input.email) {
      const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing && existing.id !== id) throw conflict('Un compte existe déjà avec cette adresse email');
    }
    if (user.role === Role.ADMIN) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      if (input.isActive === false || (input.role && input.role !== Role.ADMIN)) {
        const otherAdmins = await tx.user.count({ where: { organizationId, role: Role.ADMIN, isActive: true, id: { not: id } } });
        if (otherAdmins === 0) throw conflict('L’organisation doit conserver au moins un administrateur actif');
      }
    }
    return tx.user.update({
      where: { id },
      data: { ...data, ...(passwordHash ? { passwordHash } : {}) },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (password) await revokeUserRefreshSessions(organizationId, id);
  return updated;
}

export async function deactivateUser(organizationId: string, id: string, actorId: string, actorRole: Role): Promise<void> {
  if (id === actorId) throw forbidden('Vous ne pouvez pas supprimer votre propre compte');
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, organizationId } });
    if (!user) throw notFound('Utilisateur');
    assertCanManageUser(actorRole, user.role);
    if (user.role === Role.ADMIN) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const otherAdmins = await tx.user.count({ where: { organizationId, role: Role.ADMIN, isActive: true, id: { not: id } } });
      if (otherAdmins === 0) throw conflict('L’organisation doit conserver au moins un administrateur actif');
    }
    await tx.user.update({ where: { id: user.id }, data: { isActive: false } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function assertCanManageUser(actorRole: Role, targetRole: Role): void {
  if (actorRole !== Role.ADMIN && (targetRole === Role.ADMIN || targetRole === Role.MANAGER)) {
    throw forbidden('Seul un administrateur peut gérer un administrateur ou un manager');
  }
}

function assertCanAssignRole(actorRole: Role, targetRole: Role): void {
  if (actorRole !== Role.ADMIN && targetRole === Role.ADMIN) {
    throw forbidden('Seul un administrateur peut créer ou promouvoir un administrateur');
  }
  if (actorRole === Role.MANAGER && targetRole === Role.MANAGER) {
    throw forbidden('Seul un administrateur peut créer ou promouvoir un manager');
  }
}
