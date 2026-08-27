import { z } from 'zod';

export const listUsersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(255).trim().optional(),
    role: z.enum(['employee', 'manager', 'admin']).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });
