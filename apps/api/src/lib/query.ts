import { z } from 'zod';
import { badRequest } from './errors.js';

export const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'La date de début doit être antérieure à la date de fin',
    path: ['from'],
  });

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

export function boundedDateRange(input: DateRangeInput): { from: Date; to: Date } {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const maxDays = 366;
  if (to.getTime() - from.getTime() > maxDays * 24 * 60 * 60 * 1000) {
    throw badRequest('La période ne peut pas dépasser 366 jours');
  }
  return { from, to };
}
