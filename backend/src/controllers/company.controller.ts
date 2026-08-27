import type { Request, Response } from 'express';
import { companyService } from '../services/company.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const companyController = {
  /** GET /api/companies/me */
  getMine: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await companyService.getMine(req.auth.companyId));
  }),

  /**
   * POST /api/companies and POST /api/companies/join
   * Company creation and joining happen at registration time (see
   * POST /api/auth/register). These endpoints exist for API completeness and
   * return a clear 400 explaining the correct flow.
   */
  create: asyncHandler(async () => {
    throw AppError.badRequest(
      'Create a company via POST /api/auth/register with { companyName }. ' +
        'The first user of a new company becomes its admin.',
    );
  }),

  join: asyncHandler(async () => {
    companyService.joinNotSupported();
  }),

  /** PATCH /api/companies/me — admin only (route-gated). */
  rename: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await companyService.rename(req.auth.companyId, req.body.name));
  }),
};
