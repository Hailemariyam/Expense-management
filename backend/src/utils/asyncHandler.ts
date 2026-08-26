import type { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error pipeline instead of becoming unhandled rejections. Lets controllers be
 * written as plain `async` functions with no try/catch boilerplate.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
