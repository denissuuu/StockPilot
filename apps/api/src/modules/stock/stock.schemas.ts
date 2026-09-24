import { AdjustmentReason, MovementType } from '@prisma/client';
import { z } from 'zod';
import { decimalPlaces } from '../../lib/validation.js';

const optionalDate = z.coerce.date().optional();

export const listMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  type: z.nativeEnum(MovementType).optional(),
  from: optionalDate,
  to: optionalDate,
  search: z.string().trim().max(120).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Période invalide', path: ['from'] });

export const createAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().refine((value) => value !== 0 && decimalPlaces(value, 4), 'La quantité doit être non nulle et avoir au plus 4 décimales'),
  reason: z.nativeEnum(AdjustmentReason),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const createInitialStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive().refine((value) => decimalPlaces(value, 4), 'La quantité doit avoir au plus 4 décimales'),
  unitCost: z.coerce.number().finite().min(0).refine((value) => decimalPlaces(value, 4), 'Le coût doit avoir au plus 4 décimales').optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const listAdjustmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  reason: z.nativeEnum(AdjustmentReason).optional(),
  from: optionalDate,
  to: optionalDate,
});

export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type CreateInitialStockInput = z.infer<typeof createInitialStockSchema>;
export type ListAdjustmentsInput = z.infer<typeof listAdjustmentsSchema>;
