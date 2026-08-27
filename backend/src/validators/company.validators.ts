import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

export const renameCompanySchema = z.object({
  name: z.string().min(1).max(255).trim(),
});
