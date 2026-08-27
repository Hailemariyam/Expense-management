import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Request validation middleware. Parses and REPLACES req.body / req.query /
 * req.params with the schema's typed output, so controllers can trust their
 * inputs without re-checking. Invalid requests never reach the controller.
 */
interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        // req.query is a getter on Express 5-style; assign parsed values field-by-field.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
        Object.assign(req.query, parsed);
      }
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(
          AppError.badRequest('Request validation failed', {
            issues: err.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          }),
        );
        return;
      }
      next(err);
    }
  };
}
