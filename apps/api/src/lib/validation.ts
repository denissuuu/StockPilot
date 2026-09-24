import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
