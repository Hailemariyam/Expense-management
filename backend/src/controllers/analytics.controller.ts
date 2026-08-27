import type { Request, Response } from 'express';
import { expenseService } from '../services/expense.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

/**
 * Analytics is company-wide data, so these endpoints are gated to
 * manager/admin at the route level. All queries are companyId-scoped.
 */
export const analyticsController = {
  /** GET /api/analytics/monthly?months=6 */
  monthly: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const months = Number((req.query.months as string) ?? 6);
    return ok(res, await expenseService.monthly(req.auth.companyId, months));
  }),

  /** GET /api/analytics/by-category?dateFrom&dateTo */
  byCategory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    return ok(res, await expenseService.byCategory(req.auth.companyId, dateFrom, dateTo));
  }),

  /** GET /api/analytics/dashboard — headline figures for the dashboard page. */
  dashboard: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await expenseService.dashboard(req.auth.companyId));
  }),
};
