import { Role } from '@prisma/client';
import { z } from 'zod';

const roleSchema = z.nativeEnum(Role);
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre');

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  isActive: z.preprocess((value) => {
    if (value === undefined) return undefined;
    return value === true || value === 'true' || value === '1';
  }, z.boolean()).optional(),
});

export const createUserSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: roleSchema.default('EMPLOYEE'),
});

export const updateUserSchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()).optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ est requis' });

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
