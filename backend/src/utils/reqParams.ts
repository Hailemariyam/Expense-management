import type { Request } from 'express';
import { AppError } from './AppError.js';

/**
 * Read a route param that upstream `validate({ params })` has already proven
 * present. The runtime check is a belt-and-braces guard for routes wired
 * without a params validator.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw AppError.badRequest(`Missing route parameter: ${name}`);
  }
  return value;
}
