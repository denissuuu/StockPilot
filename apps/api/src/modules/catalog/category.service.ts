import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import type { CreateCategoryInput, ListCategoriesInput, UpdateCategoryInput } from './category.schemas.js';

export async function listCategories(organizationId: string, input: ListCategoriesInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.CategoryWhereInput = {
    organizationId,
    ...(input.search ? { name: { contains: input.search, mode: 'insensitive' } } : {}),
  };
  const [categories, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.count({ where }),
  ]);
  return { categories, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function getCategory(organizationId: string, id: string) {
  const category = await prisma.category.findFirst({ where: { id, organizationId } });
  if (!category) throw notFound('Catégorie');
  return category;
}

export async function createCategory(organizationId: string, input: CreateCategoryInput) {
  if (input.parentId) await assertParent(organizationId, input.parentId);
  const duplicate = await prisma.category.findFirst({ where: { organizationId, name: input.name } });
  if (duplicate) throw conflict('Une catégorie porte déjà ce nom');
  return prisma.category.create({ data: { organizationId, ...input } });
}

export async function updateCategory(organizationId: string, id: string, input: UpdateCategoryInput) {
  await getCategory(organizationId, id);
  if (input.parentId) {
    if (input.parentId === id) throw conflict('Une catégorie ne peut pas être son propre parent');
    await assertParent(organizationId, input.parentId);
  }
  if (input.name) {
    const duplicate = await prisma.category.findFirst({ where: { organizationId, name: input.name, id: { not: id } } });
    if (duplicate) throw conflict('Une catégorie porte déjà ce nom');
  }
  return prisma.category.update({ where: { id }, data: input });
}

export async function deleteCategory(organizationId: string, id: string): Promise<void> {
  await getCategory(organizationId, id);
  const [products, children] = await prisma.$transaction([
    prisma.product.count({ where: { organizationId, categoryId: id } }),
    prisma.category.count({ where: { organizationId, parentId: id } }),
  ]);
  if (products > 0 || children > 0) throw conflict('La catégorie contient des produits ou sous-catégories');
  await prisma.category.delete({ where: { id } });
}

async function assertParent(organizationId: string, parentId: string): Promise<void> {
  const parent = await prisma.category.findFirst({ where: { id: parentId, organizationId } });
  if (!parent) throw notFound('Catégorie parente');
}
