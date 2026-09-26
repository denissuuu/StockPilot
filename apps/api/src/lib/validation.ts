import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Schéma de validation pour les identifiants UUID v4.
 * Utilisé dans les paramètres de route et les corps de requête.
 */
export const uuidSchema = z.string().uuid();

export function decimalPlaces(value: number, maximum: number): boolean {
  return new Prisma.Decimal(value).decimalPlaces() <= maximum;
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
