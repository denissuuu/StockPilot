import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { conflict } from './errors.js';

/**
 * Calcule un hash SHA-256 d'une valeur pour la détection d'idempotence.
 * Utilisé pour éviter les doubles traitements (ventes, réceptions).
 */
export function idempotencyHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function acquireIdempotencyKey(
  tx: Prisma.TransactionClient,
  organizationId: string,
  operation: string,
  key: string | undefined,
  requestHash: string,
): Promise<string | null> {
  if (!key) return null;

  const record = await tx.idempotencyKey.upsert({
    where: { organizationId_operation_key: { organizationId, operation, key } },
    create: { organizationId, operation, key, requestHash },
    update: {},
  });

  if (record.requestHash !== requestHash) {
    throw conflict('Cette clé d’idempotence a déjà été utilisée avec une autre requête');
  }
  if (record.resourceId) return record.resourceId;
  return null;
}

export async function completeIdempotencyKey(
  tx: Prisma.TransactionClient,
  organizationId: string,
  operation: string,
  key: string | undefined,
  resourceId: string,
): Promise<void> {
  if (!key) return;
  await tx.idempotencyKey.update({
    where: { organizationId_operation_key: { organizationId, operation, key } },
    data: { resourceId },
  });
}
