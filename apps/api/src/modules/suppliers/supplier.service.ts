import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import type { CreateSupplierInput, ListSuppliersInput, UpdateSupplierInput } from './supplier.schemas.js';

export async function listSuppliers(organizationId: string, input: ListSuppliersInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.SupplierWhereInput = {
    organizationId,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? { OR: [{ name: { contains: input.search, mode: 'insensitive' } }, { email: { contains: input.search, mode: 'insensitive' } }, { taxId: { contains: input.search, mode: 'insensitive' } }] }
      : {}),
  };
  const [suppliers, total] = await prisma.$transaction([
    prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { _count: { select: { purchaseOrders: true } } } }),
    prisma.supplier.count({ where }),
  ]);
  return { suppliers, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function getSupplier(organizationId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId } });
  if (!supplier) throw notFound('Fournisseur');
  return supplier;
}

export async function createSupplier(organizationId: string, input: CreateSupplierInput) {
  return prisma.supplier.create({ data: { organizationId, ...input } });
}

export async function updateSupplier(organizationId: string, id: string, input: UpdateSupplierInput) {
  await getSupplier(organizationId, id);
  return prisma.supplier.update({ where: { id }, data: input });
}

export async function deactivateSupplier(organizationId: string, id: string): Promise<void> {
  await getSupplier(organizationId, id);
  await prisma.supplier.update({ where: { id }, data: { isActive: false } });
}
