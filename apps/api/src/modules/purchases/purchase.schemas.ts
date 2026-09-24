import { PurchaseOrderStatus } from '@prisma/client';
import { z } from 'zod';

const lineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive(),
  unitCost: z.coerce.number().finite().min(0),
  discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
  taxRate: z.coerce.number().finite().min(0).max(100).default(20),
});

export const listPurchaseOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  supplierId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Période invalide', path: ['from'] });

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  reference: z.string().trim().max(80).nullable().optional(),
  expectedAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(lineSchema).min(1).max(500),
}).superRefine((value, ctx) => {
  const ids = value.lines.map((line) => line.productId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Un produit ne peut apparaître qu’une fois' });
});

export const updatePurchaseOrderSchema = z.object({
  reference: z.string().trim().max(80).nullable().optional(),
  expectedAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export const receivePurchaseOrderSchema = z.object({
  receivedAt: z.coerce.date().optional(),
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    quantity: z.coerce.number().finite().positive(),
  })).min(1).max(500),
}).superRefine((value, ctx) => {
  const ids = value.lines.map((line) => line.lineId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Une ligne ne peut être reçue qu’une fois' });
});

export type ListPurchaseOrdersInput = z.infer<typeof listPurchaseOrdersSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
