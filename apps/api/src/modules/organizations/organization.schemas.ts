import { z } from 'zod';

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    legalName: z.string().trim().max(200).nullable().optional(),
    taxId: z.string().trim().max(80).nullable().optional(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
