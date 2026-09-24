import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import type { CreateCustomerInput, ListCustomersInput, UpdateCustomerInput } from './customer.schemas.js';

export async function listCustomers(organizationId: string, input: ListCustomersInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.CustomerWhereInput = {
    organizationId,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search ? { OR: [{ name: { contains: input.search, mode: 'insensitive' } }, { email: { contains: input.search, mode: 'insensitive' } }, { taxId: { contains: input.search, mode: 'insensitive' } }] } : {}),
  };
  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { _count: { select: { sales: true } } } }),
    prisma.customer.count({ where }),
  ]);
  return { customers, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function getCustomer(organizationId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, organizationId } });
  if (!customer) throw notFound('Client');
  return customer;
}

export async function createCustomer(organizationId: string, input: CreateCustomerInput) {
  return prisma.customer.create({ data: { organizationId, ...input } });
}

export async function updateCustomer(organizationId: string, id: string, input: UpdateCustomerInput) {
  await getCustomer(organizationId, id);
  return prisma.customer.update({ where: { id }, data: input });
}

export async function deactivateCustomer(organizationId: string, id: string): Promise<void> {
  await getCustomer(organizationId, id);
  await prisma.customer.update({ where: { id }, data: { isActive: false } });
}
