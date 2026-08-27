import { z } from 'zod';

export const uuidParam = z.object({ id: z.string().uuid('Invalid id') });

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/** Money as a string with up to 2 decimals, positive. Kept as string end-to-end. */
export const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'amount must be a positive number with up to 2 decimals')
  .refine((v) => Number(v) > 0, 'amount must be greater than 0');

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid calendar date');
