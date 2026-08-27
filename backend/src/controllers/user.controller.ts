import type { Request, Response } from 'express';
import { userService } from '../services/user.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';
import { param } from '../utils/reqParams.js';

/** Admin-only company user management (route-gated by authorize('admin')). */
export const userController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const { items, total } = await userService.list(req.auth.companyId, page, pageSize);
    return ok(res, items, 200, { page, pageSize, total });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await userService.getById(param(req, 'id'), req.auth.companyId));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    return ok(res, await userService.update(param(req, 'id'), req.auth, req.body));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    await userService.remove(param(req, 'id'), req.auth);
    return noContent(res);
  }),
};
