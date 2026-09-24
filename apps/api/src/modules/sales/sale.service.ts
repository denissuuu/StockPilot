import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { calculateSaleLine, calculateSaleTotals } from '../../lib/financial.js';
import { getCurrentStocks } from '../catalog/stock.service.js';
import type { CreateSaleInput, ListSalesInput } from './sale.schemas.js';

const saleInclude = {
  customer: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: { orderBy: { id: 'asc' } },
} as const;

export async function listSales(organizationId: string, input: ListSalesInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.SaleWhereInput = {
    organizationId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.from || input.to ? { soldAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
    ...(input.search ? { OR: [{ reference: { contains: input.search, mode: 'insensitive' } }, { customer: { name: { contains: input.search, mode: 'insensitive' } } }] } : {}),
  };
  const [sales, total] = await prisma.$transaction([
    prisma.sale.findMany({ where, skip, take, orderBy: { soldAt: 'desc' }, include: saleInclude }),
    prisma.sale.count({ where }),
  ]);
  return { sales, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function getSale(organizationId: string, id: string) {
  const sale = await prisma.sale.findFirst({ where: { id, organizationId }, include: saleInclude });
  if (!sale) throw notFound('Vente');
  return sale;
}

export async function createSale(organizationId: string, createdById: string, input: CreateSaleInput) {
  return prisma.$transaction(async (tx) => {
    if (input.customerId) {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, organizationId, isActive: true } });
      if (!customer) throw notFound('Client');
    }
    const products = await tx.product.findMany({ where: { organizationId, id: { in: input.lines.map((line) => line.productId) }, isActive: true } });
    if (products.length !== new Set(input.lines.map((line) => line.productId)).size) throw unprocessable('Un ou plusieurs produits sont invalides');
    const productById = new Map(products.map((product) => [product.id, product]));
    const stocks = await getCurrentStocks(tx, organizationId, products.map((product) => product.id));
    const calculated = input.lines.map((line) => {
      const product = productById.get(line.productId)!;
      const stock = stocks.get(product.id) ?? new Prisma.Decimal(0);
      if (stock.lt(line.quantity)) throw unprocessable('Stock insuffisant pour une ou plusieurs lignes', { productId: product.id, available: stock.toString(), requested: line.quantity });
      const financial = calculateSaleLine({
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? product.salePrice,
        unitCost: product.costPrice,
        discountPercent: line.discountPercent,
        taxRate: line.taxRate ?? product.taxRate,
      });
      return { line, product, financial };
    });
    const totals = calculateSaleTotals(calculated.map(({ financial }) => financial));
    const sale = await tx.sale.create({
      data: {
        organizationId,
        customerId: input.customerId,
        reference: input.reference,
        soldAt: input.soldAt ?? new Date(),
        notes: input.notes,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        costTotal: totals.costTotal,
        grossProfit: totals.grossProfit,
        marginPercent: totals.marginPercent,
        createdById,
        lines: {
          create: calculated.map(({ product, financial }) => ({
            productId: product.id,
            productSku: product.sku,
            productName: product.name,
            quantity: financial.quantity,
            unitPrice: financial.unitPrice,
            unitCost: financial.unitCost,
            discountPercent: financial.discountPercent,
            taxRate: financial.taxRate,
            lineSubtotal: financial.lineSubtotal,
            taxAmount: financial.taxAmount,
            lineTotal: financial.lineTotal,
            costTotal: financial.costTotal,
            lineProfit: financial.lineProfit,
          })),
        },
      },
      include: saleInclude,
    });
    for (const { product, financial } of calculated) {
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: product.id,
          type: 'SALE',
          quantity: financial.quantity.neg(),
          referenceType: 'SALE',
          referenceId: sale.id,
          note: `Vente ${sale.reference ?? sale.id}`,
          unitCost: financial.unitCost,
          totalValue: financial.costTotal,
          createdById,
        },
      });
    }
    return sale;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelSale(organizationId: string, id: string, createdById: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, organizationId }, include: { lines: true } });
    if (!sale) throw notFound('Vente');
    if (sale.status === 'CANCELLED') throw conflict('La vente est déjà annulée');
    for (const line of sale.lines) {
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: line.productId,
          type: 'RETURN_IN',
          quantity: line.quantity,
          referenceType: 'SALE_CANCELLATION',
          referenceId: sale.id,
          note: `Annulation vente ${sale.reference ?? sale.id}`,
          unitCost: line.unitCost,
          totalValue: line.costTotal,
          createdById,
        },
      });
    }
    return tx.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED' }, include: saleInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
