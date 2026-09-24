import { z } from 'zod';

const activeFilter = z.preprocess((value) => {
  if (value === undefined) return undefined;
  return value === true || value === 'true' || value === '1';
}, z.boolean());

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  isActive: activeFilter.optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(180),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  taxId: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(180).optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    address: z.string().trim().max(1000).nullable().optional(),
    taxId: z.string().trim().max(80).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
