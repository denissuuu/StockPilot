import { SaleStatus } from '@prisma/client';
import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().min(0).optional(),
  discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
  taxRate: z.coerce.number().finite().min(0).max(100).optional(),
});

export const listSalesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  customerId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Période invalide', path: ['from'] });

export const createSaleSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  reference: z.string().trim().max(80).nullable().optional(),
  soldAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(lineSchema).min(1).max(500),
}).superRefine((value, ctx) => {
  const ids = value.lines.map((line) => line.productId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Un produit ne peut apparaître qu’une fois' });
});

export type ListSalesInput = z.infer<typeof listSalesSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
