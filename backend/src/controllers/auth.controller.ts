import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok } from '../utils/http.js';

/**
 * Controllers are thin: translate HTTP ⇄ service calls, no business logic.
 */
export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    return created(res, result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return ok(res, result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    return ok(res, result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    await authService.logout(req.body?.refreshToken, req.auth.userId);
    return ok(res, { success: true });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw AppError.unauthenticated();
    const user = await authService.me(req.auth.userId, req.auth.companyId);
    return ok(res, user);
  }),
};
