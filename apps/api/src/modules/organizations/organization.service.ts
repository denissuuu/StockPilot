import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { UpdateOrganizationInput } from './organization.schemas.js';

export async function getOrganization(organizationId: string) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw notFound('Organisation');
  return organization;
}

export async function updateOrganization(organizationId: string, input: UpdateOrganizationInput) {
  return prisma.organization.update({ where: { id: organizationId }, data: input });
}
