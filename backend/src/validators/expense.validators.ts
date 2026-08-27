import { z } from 'zod';
import { isoDate, moneyString } from './common.js';

const category = z.string().min(1).max(100).trim();
const comment = z.string().max(2000).trim();

/**
 * Create accepts multipart/form-data (fields alongside an optional `receipt`
 * file), so every field arrives as a string — hence coercion-friendly schemas.
 */
export const createExpenseSchema = z.object({
  amount: moneyString,
  category,
  expenseDate: isoDate,
  comment: comment.optional(),
});

export const updateExpenseSchema = z
  .object({
    amount: moneyString.optional(),
    category: category.optional(),
    expenseDate: isoDate.optional(),
    comment: comment.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const listExpensesQuery = z.object({
  scope: z.enum(['me', 'team']).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  category: z.string().min(1).max(100).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const setStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const monthlyQuery = z.object({
  months: z.coerce.number().int().positive().max(24).default(6),
});

export const byCategoryQuery = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});
