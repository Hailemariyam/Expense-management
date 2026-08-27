import { z } from 'zod';

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const email = z.string().email().max(255).toLowerCase().trim();
const name = z.string().min(1).max(255).trim();

export const registerSchema = z
  .object({
    name,
    email,
    password,
    companyName: z.string().min(1).max(255).trim().optional(),
    companyId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.companyName) !== Boolean(d.companyId), {
    message: 'Provide exactly one of companyName (create) or companyId (join)',
    path: ['companyName'],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});
