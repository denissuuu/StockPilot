import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma partagée avec réutilisation en développement
 * pour éviter l'épuisement des connexions lors du rechargement à chaud.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://stockpilot:stockpilot@localhost:5432/stockpilot?schema=public';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
