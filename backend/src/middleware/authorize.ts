import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

/**
 * RBAC gate. Use after `authenticate`:
 *
 *   router.get('/users', authenticate, authorize('admin'), ctrl.list)
 *   router.patch('/expenses/:id/status', authenticate, authorize('manager', 'admin'), ctrl.setStatus)
 *
 * Role alone is never sufficient for data access — tenant ownership is still
 * enforced in the repository layer (every query is scoped by companyId). This
 * middleware only answers "is this role allowed to call this endpoint at all?".
 */
export function authorize(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw AppError.unauthenticated();
    if (!allowed.includes(req.auth.role)) {
      throw AppError.forbidden(
        `Requires role: ${allowed.join(' or ')} (you are '${req.auth.role}')`,
      );
    }
    next();
  };
}
