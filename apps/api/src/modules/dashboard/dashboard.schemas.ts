import { z } from 'zod';

export const dashboardSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'La date de début doit être antérieure à la date de fin',
  path: ['from'],
});

export type DashboardInput = z.infer<typeof dashboardSchema>;
