import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export function decimalPlaces(value: number, maximum: number): boolean {
  return new Prisma.Decimal(value).decimalPlaces() <= maximum;
}

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
