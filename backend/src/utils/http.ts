import type { Response } from 'express';

/**
 * Uniform success envelope so the frontend always sees the same shape:
 *   { data: <payload>, meta?: <pagination/etc> }
 * Errors use a parallel shape from the error handler: { error: { code, message, details? } }
 */
export function ok<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return ok(res, data, 201, meta);
}

export function noContent(res: Response) {
  return res.status(204).send();
}
