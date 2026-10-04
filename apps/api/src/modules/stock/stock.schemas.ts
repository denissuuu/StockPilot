import { AdjustmentReason, MovementType } from '@prisma/client';
import { z } from 'zod';
import { NUMERIC_COLUMN, boundedByColumn } from '../../lib/validation.js';
import { coherentDateRange, dateRangeShape, isCoherentDateRange } from '../../lib/query.js';

export const listMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  type: z.nativeEnum(MovementType).optional(),
  ...dateRangeShape,
  search: z.string().trim().max(120).optional(),
}).refine(isCoherentDateRange, coherentDateRange);

export const createAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().refine((value) => value !== 0, 'La quantité doit être non nulle').superRefine(boundedByColumn(NUMERIC_COLUMN.quantity, 'La quantité')),
  reason: z.nativeEnum(AdjustmentReason),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const createInitialStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive().superRefine(boundedByColumn(NUMERIC_COLUMN.quantity, 'La quantité')),
  unitCost: z.coerce.number().finite().min(0).superRefine(boundedByColumn(NUMERIC_COLUMN.unitAmount, 'Le coût')).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const listAdjustmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  reason: z.nativeEnum(AdjustmentReason).optional(),
  ...dateRangeShape,
}).refine(isCoherentDateRange, coherentDateRange);

export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type CreateInitialStockInput = z.infer<typeof createInitialStockSchema>;
export type ListAdjustmentsInput = z.infer<typeof listAdjustmentsSchema>;
