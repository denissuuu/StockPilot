import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { getCurrentStock } from '../catalog/stock.service.js';
import type { CreateAdjustmentInput, CreateInitialStockInput, ListAdjustmentsInput, ListMovementsInput } from './stock.schemas.js';

const movementInclude = {
  product: { select: { id: true, sku: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

const adjustmentInclude = {
  product: { select: { id: true, sku: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  movement: true,
} as const;

export async function listMovements(organizationId: string, input: ListMovementsInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.StockMovementWhereInput = {
    organizationId,
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
    ...(input.search ? { OR: [{ note: { contains: input.search, mode: 'insensitive' } }, { product: { name: { contains: input.search, mode: 'insensitive' } } }, { product: { sku: { contains: input.search, mode: 'insensitive' } } }] } : {}),
  };
  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: movementInclude }),
    prisma.stockMovement.count({ where }),
  ]);
  return { movements, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function createInitialStock(organizationId: string, createdById: string, input: CreateInitialStockInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, organizationId, isActive: true } });
    if (!product) throw notFound('Produit');
    const existingInitial = await tx.stockMovement.findFirst({ where: { organizationId, productId: product.id, type: 'INITIAL' } });
    if (existingInitial) throw conflict('Le stock initial de ce produit est déjà enregistré ; utilisez un ajustement');
    const current = await getCurrentStock(tx, organizationId, product.id);
    if (current.plus(input.quantity).isNegative()) throw unprocessable('Le stock ne peut pas être négatif');
    const unitCost = input.unitCost ?? product.costPrice;
    return tx.stockMovement.create({
      data: {
        organizationId,
        productId: product.id,
        type: 'INITIAL',
        quantity: input.quantity,
        note: input.note ?? 'Stock initial',
        unitCost,
        totalValue: new Prisma.Decimal(input.quantity).mul(unitCost).toDecimalPlaces(2),
        createdById,
      },
      include: movementInclude,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createAdjustment(organizationId: string, createdById: string, input: CreateAdjustmentInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, organizationId, isActive: true } });
    if (!product) throw notFound('Produit');
    const current = await getCurrentStock(tx, organizationId, product.id);
    const change = new Prisma.Decimal(input.quantity);
    const next = current.plus(change);
    if (next.isNegative()) throw unprocessable('L’ajustement rendrait le stock négatif');

    const adjustmentId = randomUUID();
    const movementId = randomUUID();
    await tx.stockMovement.create({
      data: {
        id: movementId,
        organizationId,
        productId: product.id,
        type: change.isPositive() ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: change,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: adjustmentId,
        reason: input.reason,
        note: input.note,
        unitCost: product.costPrice,
        totalValue: change.abs().mul(product.costPrice).toDecimalPlaces(2),
        createdById,
      },
    });
    const adjustment = await tx.stockAdjustment.create({
      data: {
        id: adjustmentId,
        organizationId,
        productId: product.id,
        quantity: change,
        reason: input.reason,
        note: input.note,
        movementId,
        createdById,
      },
      include: adjustmentInclude,
    });
    return adjustment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listAdjustments(organizationId: string, input: ListAdjustmentsInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.StockAdjustmentWhereInput = {
    organizationId,
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
  };
  const [adjustments, total] = await prisma.$transaction([
    prisma.stockAdjustment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: adjustmentInclude }),
    prisma.stockAdjustment.count({ where }),
  ]);
  return { adjustments, meta: pageMeta({ ...input, page, pageSize }, total) };
}
