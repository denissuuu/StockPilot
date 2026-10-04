import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { acquireIdempotencyKey, completeIdempotencyKey, idempotencyHash } from '../../lib/idempotency.js';
import { calculatePurchaseLine, calculatePurchaseTotals, decimal } from '../../lib/financial.js';
import { getCurrentStocks } from '../catalog/stock.service.js';
import type { CreatePurchaseOrderInput, ListPurchaseOrdersInput, ReceivePurchaseOrderInput, UpdatePurchaseOrderInput } from './purchase.schemas.js';

const orderInclude = {
  supplier: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: { include: { product: { select: { id: true, sku: true, name: true } } }, orderBy: { id: 'asc' } },
} as const;

async function lockPurchaseOrder(tx: Prisma.TransactionClient, organizationId: string, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
  return tx.purchaseOrder.findFirst({
    where: { id, organizationId },
    include: { lines: { include: { product: true } } },
  });
}

export async function listPurchaseOrders(organizationId: string, input: ListPurchaseOrdersInput) {
  const { skip, take, page, pageSize } = pagination(input);
  const where: Prisma.PurchaseOrderWhereInput = {
    organizationId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}),
    ...(input.search ? { OR: [{ reference: { contains: input.search, mode: 'insensitive' } }, { supplier: { name: { contains: input.search, mode: 'insensitive' } } }] } : {}),
  };
  const [orders, total] = await prisma.$transaction([
    prisma.purchaseOrder.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: orderInclude }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { orders, meta: pageMeta({ ...input, page, pageSize }, total) };
}

export async function getPurchaseOrder(organizationId: string, id: string) {
  const order = await prisma.purchaseOrder.findFirst({ where: { id, organizationId }, include: orderInclude });
  if (!order) throw notFound('Commande fournisseur');
  return order;
}

export async function createPurchaseOrder(organizationId: string, createdById: string, input: CreatePurchaseOrderInput) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, organizationId, isActive: true } });
    if (!supplier) throw notFound('Fournisseur');
    const products = await tx.product.findMany({ where: { organizationId, id: { in: input.lines.map((line) => line.productId) }, isActive: true } });
    if (products.length !== new Set(input.lines.map((line) => line.productId)).size) throw unprocessable('Un ou plusieurs produits sont invalides');
    const productById = new Map(products.map((product) => [product.id, product]));
    const calculated = input.lines.map((line) => {
      const product = productById.get(line.productId)!;
      // La TVA suit le produit, sauf taux explicite sur la ligne (TVA réduite, exonération).
      const taxRate = line.taxRate ?? product.taxRate;
      const totals = calculatePurchaseLine({ quantity: line.quantity, unitCost: line.unitCost, discountPercent: line.discountPercent, taxRate });
      return { input: line, taxRate, totals, product };
    });
    const totals = calculatePurchaseTotals(calculated.map((line) => line.totals));
    return tx.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: input.supplierId,
        reference: input.reference,
        expectedAt: input.expectedAt,
        notes: input.notes,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        createdById,
        lines: {
          create: calculated.map(({ input: line, taxRate, totals: lineTotals }) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            discountPercent: line.discountPercent,
            taxRate,
            lineSubtotal: lineTotals.lineSubtotal,
            taxAmount: lineTotals.taxAmount,
            lineTotal: lineTotals.lineTotal,
          })),
        },
      },
      include: orderInclude,
    });
  });
}

export async function updatePurchaseOrder(organizationId: string, id: string, input: UpdatePurchaseOrderInput) {
  return prisma.$transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, organizationId, id);
    if (!order) throw notFound('Commande fournisseur');
    if (order.status !== 'DRAFT') throw conflict('Seule une commande brouillon peut être modifiée');
    return tx.purchaseOrder.update({ where: { id }, data: input, include: orderInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markPurchaseOrderOrdered(organizationId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, organizationId, id);
    if (!order) throw notFound('Commande fournisseur');
    if (order.status !== 'DRAFT') throw conflict('La commande a déjà été transmise ou clôturée');
    return tx.purchaseOrder.update({ where: { id }, data: { status: 'ORDERED', orderedAt: new Date() }, include: orderInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelPurchaseOrder(organizationId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockPurchaseOrder(tx, organizationId, id);
    if (!order) throw notFound('Commande fournisseur');
    if (order.status === 'RECEIVED' || order.status === 'PARTIALLY_RECEIVED' || order.status === 'CANCELLED') {
      throw conflict('Cette commande ne peut plus être annulée');
    }
    return tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' }, include: orderInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function receivePurchaseOrder(organizationId: string, id: string, createdById: string, input: ReceivePurchaseOrderInput, idempotencyKey?: string) {
  return prisma.$transaction(async (tx) => {
    const operation = `purchase:${id}:receive`;
    const replayId = await acquireIdempotencyKey(tx, organizationId, operation, idempotencyKey, idempotencyHash(input));
    if (replayId) return tx.purchaseOrder.findUniqueOrThrow({ where: { id: replayId }, include: orderInclude });

    const order = await lockPurchaseOrder(tx, organizationId, id);
    if (!order) throw notFound('Commande fournisseur');
    if (order.status !== 'ORDERED' && order.status !== 'PARTIALLY_RECEIVED') {
      throw conflict('Seule une commande transmise peut être réceptionnée');
    }

    const linesById = new Map(order.lines.map((line) => [line.id, line]));
    for (const receipt of input.lines) {
      const line = linesById.get(receipt.lineId);
      if (!line) throw unprocessable('Une ligne de réception est inconnue');
      const remaining = decimal(line.quantity).minus(line.receivedQuantity);
      if (decimal(receipt.quantity).gt(remaining)) throw unprocessable('Quantité reçue supérieure à la quantité restante', { lineId: receipt.lineId, remaining: remaining.toString() });
    }

    const currentStocks = await getCurrentStocks(tx, organizationId, order.lines.map((line) => line.productId));
    for (const receipt of input.lines) {
      const line = linesById.get(receipt.lineId)!;
      const quantity = decimal(receipt.quantity);
      const totalValue = quantity.mul(line.unitCost).toDecimalPlaces(2);
      const currentStock = currentStocks.get(line.productId) ?? new Prisma.Decimal(0);
      const nextStock = currentStock.plus(quantity);
      const averageCost = nextStock.gt(0)
        ? currentStock.mul(line.product.costPrice).plus(quantity.mul(line.unitCost)).div(nextStock).toDecimalPlaces(4)
        : line.product.costPrice;
      await tx.product.update({ where: { id: line.productId }, data: { costPrice: averageCost } });
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: line.productId,
          type: 'PURCHASE_RECEIPT',
          quantity,
          referenceType: 'PURCHASE_ORDER',
          referenceId: order.id,
          note: `Réception commande ${order.reference ?? order.id}`,
          unitCost: line.unitCost,
          totalValue,
          createdById,
        },
      });
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: decimal(line.receivedQuantity).plus(quantity) } });
    }

    const refreshed = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
    const fullyReceived = refreshed.lines.every((line) => decimal(line.receivedQuantity).gte(line.quantity));
    const anyReceived = refreshed.lines.some((line) => decimal(line.receivedQuantity).gt(0));
    const updatedOrder = await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: fullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : order.status,
        receivedAt: fullyReceived ? (input.receivedAt ?? new Date()) : null,
      },
      include: orderInclude,
    });
    await completeIdempotencyKey(tx, organizationId, operation, idempotencyKey, updatedOrder.id);
    return updatedOrder;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
