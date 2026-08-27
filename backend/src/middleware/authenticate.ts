import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Step 1 of the middleware chain (per SOW §3 request flow):
 *   authenticate → tenant/RBAC → controller → service → repository → DB
 *
 * Extracts and verifies the Bearer access token, then attaches the
 * { userId, companyId, role } context to req.auth. Every protected route
 * downstream relies on req.auth being present and trustworthy.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw AppError.unauthenticated('Missing Bearer token');
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);

  req.auth = {
    userId: payload.sub,
    companyId: payload.companyId,
    role: payload.role,
  };

  next();
}
