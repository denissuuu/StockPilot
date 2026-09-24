import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getCurrentStock(db: DbClient, organizationId: string, productId: string): Promise<Prisma.Decimal> {
  const result = await db.stockMovement.aggregate({
    where: { organizationId, productId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? new Prisma.Decimal(0);
}

export async function getCurrentStocks(
  db: DbClient,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, Prisma.Decimal>> {
  if (productIds.length === 0) return new Map();
  const grouped = await db.stockMovement.groupBy({
    by: ['productId'],
    where: { organizationId, productId: { in: productIds } },
    _sum: { quantity: true },
  });
  return new Map(grouped.map((row) => [row.productId, row._sum.quantity ?? new Prisma.Decimal(0)]));
}
