import { z } from 'zod';
import { NUMERIC_COLUMN, boundedByColumn } from '../../lib/validation.js';

// Les prix vivent dans une colonne NUMERIC(14,4) et les seuils dans une
// NUMERIC(16,4) : la magnitude maximale n'est pas la même, le message non plus.
const price = (label: string) => z.coerce.number().finite().min(0).superRefine(boundedByColumn(NUMERIC_COLUMN.unitAmount, label));
const stockLevel = (label: string) => z.coerce.number().finite().min(0).superRefine(boundedByColumn(NUMERIC_COLUMN.quantity, label));
const taxRate = z.coerce.number().finite().min(0).max(100).superRefine(boundedByColumn(NUMERIC_COLUMN.percent, 'La TVA'));
const optionalBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  return value === true || value === 'true' || value === '1';
}, z.boolean());

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  isActive: optionalBoolean.optional(),
  lowStock: optionalBoolean.optional(),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  barcode: z.string().trim().max(80).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  costPrice: price('Le prix de revient'),
  salePrice: price('Le prix de vente'),
  taxRate: taxRate.default(20),
  minStock: stockLevel('Le seuil minimum').default(0),
  maxStock: stockLevel('Le seuil maximum').nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    barcode: z.string().trim().max(80).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    costPrice: price('Le prix de revient').optional(),
    salePrice: price('Le prix de vente').optional(),
    taxRate: taxRate.optional(),
    minStock: stockLevel('Le seuil minimum').optional(),
    maxStock: stockLevel('Le seuil maximum').nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
