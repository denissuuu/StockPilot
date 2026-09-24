import { z } from 'zod';

export const listCategoriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
