import { z } from 'zod';
import type { PageMeta } from './response.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function pagination(input: PaginationInput): { page: number; pageSize: number; skip: number; take: number } {
  return {
    page: input.page,
    pageSize: input.pageSize,
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

export function pageMeta(input: PaginationInput, total: number): PageMeta {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.ceil(total / input.pageSize),
  };
}
