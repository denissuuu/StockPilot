import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import type { CreateProductInput, ListProductsInput, UpdateProductInput } from './product.schemas.js';
import { getCurrentStock, getCurrentStocks } from './stock.service.js';

export async function listProducts(organizationId: string, input: ListProductsInput) {
  const { skip, take } = pagination(input);
  const where: Prisma.ProductWhereInput = {
    organizationId,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { sku: { contains: input.search, mode: 'insensitive' } },
            { barcode: { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  if (input.lowStock) {
    const allProducts = await prisma.product.findMany({ where, orderBy: { name: 'asc' }, include: { category: true } });
    const allStocks = await getCurrentStocks(prisma, organizationId, allProducts.map((product) => product.id));
    const lowStockProducts = allProducts.filter((product) => {
      const stock = allStocks.get(product.id) ?? new Prisma.Decimal(0);
      return product.minStock.gt(0) && stock.lte(product.minStock);
    });
    const pageProducts = lowStockProducts.slice(skip, skip + take);
    return {
      products: pageProducts.map((product) => ({ product, stock: allStocks.get(product.id) ?? new Prisma.Decimal(0) })),
      meta: pageMeta(input, lowStockProducts.length),
    };
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { category: true } }),
    prisma.product.count({ where }),
  ]);
  const stocks = await getCurrentStocks(prisma, organizationId, products.map((product) => product.id));
  return {
    products: products.map((product) => ({ product, stock: stocks.get(product.id) ?? new Prisma.Decimal(0) })),
    meta: pageMeta(input, total),
  };
}

export async function getProduct(organizationId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, organizationId }, include: { category: true } });
  if (!product) throw notFound('Produit');
  const stock = await getCurrentStock(prisma, organizationId, id);
  return { product, stock };
}

export async function getProductByBarcode(organizationId: string, barcode: string) {
  const product = await prisma.product.findFirst({ where: { organizationId, barcode }, include: { category: true } });
  if (!product) throw notFound('Produit');
  const stock = await getCurrentStock(prisma, organizationId, product.id);
  return { product, stock };
}

export async function getProductAlerts(organizationId: string) {
  const products = await prisma.product.findMany({ where: { organizationId, isActive: true }, include: { category: true }, orderBy: { name: 'asc' } });
  const stocks = await getCurrentStocks(prisma, organizationId, products.map((product) => product.id));
  return products
    .map((product) => ({ product, stock: stocks.get(product.id) ?? new Prisma.Decimal(0) }))
    .filter(({ product, stock }) => product.minStock.gt(0) && stock.lte(product.minStock));
}

export async function createProduct(organizationId: string, input: CreateProductInput) {
  if (input.maxStock !== undefined && input.maxStock !== null && input.maxStock < input.minStock) {
    throw unprocessable('Le stock maximum doit être supérieur ou égal au seuil minimum');
  }
  if (input.categoryId) await assertCategory(organizationId, input.categoryId);
  const duplicate = await prisma.product.findFirst({ where: { organizationId, OR: [{ sku: input.sku }, ...(input.barcode ? [{ barcode: input.barcode }] : [])] } });
  if (duplicate) throw conflict('Un produit utilise déjà ce SKU ou ce code-barres');
  return prisma.product.create({ data: { organizationId, ...input }, include: { category: true } });
}

export async function updateProduct(organizationId: string, id: string, input: UpdateProductInput) {
  const existing = await getProduct(organizationId, id);
  if (input.categoryId) await assertCategory(organizationId, input.categoryId);
  if (input.sku || input.barcode) {
    const duplicate = await prisma.product.findFirst({
      where: {
        organizationId,
        id: { not: id },
        OR: [
          ...(input.sku ? [{ sku: input.sku }] : []),
          ...(input.barcode ? [{ barcode: input.barcode }] : []),
        ],
      },
    });
    if (duplicate) throw conflict('Un produit utilise déjà ce SKU ou ce code-barres');
  }
  const nextMinStock = input.minStock ?? existing.product.minStock;
  const nextMaxStock = input.maxStock === undefined ? existing.product.maxStock : input.maxStock;
  if (nextMaxStock !== null && nextMaxStock < nextMinStock) {
    throw unprocessable('Le stock maximum doit être supérieur ou égal au seuil minimum');
  }
  return prisma.product.update({ where: { id }, data: input, include: { category: true } });
}

export async function deactivateProduct(organizationId: string, id: string): Promise<void> {
  await getProduct(organizationId, id);
  await prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function getProductStock(organizationId: string, id: string) {
  const { product, stock } = await getProduct(organizationId, id);
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId, productId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { product: true, createdBy: true },
  });
  return { product, stock, movements };
}

async function assertCategory(organizationId: string, categoryId: string): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, organizationId } });
  if (!category) throw notFound('Catégorie');
}
