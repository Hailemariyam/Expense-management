import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** 404 for unmatched routes — registered after all route mounts. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error translator. Every thrown error — AppError, ZodError (already
 * wrapped upstream), Prisma errors, Multer errors, or anything unexpected —
 * becomes a consistent JSON envelope:
 *   { error: { code, message, details? } }
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let appErr: AppError;

  if (err instanceof AppError) {
    appErr = err;
  } else if (err instanceof MulterError) {
    appErr =
      err.code === 'LIMIT_FILE_SIZE'
        ? AppError.badRequest('Uploaded file is too large')
        : AppError.badRequest(`Upload error: ${err.message}`);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    appErr = mapPrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    appErr = AppError.badRequest('Invalid data shape for database operation');
  } else {
    appErr = AppError.internal();
  }

  if (appErr.status >= 500) {
    console.error('[error]', err);
  }

  res.status(appErr.status).json({
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details ? { details: appErr.details } : {}),
      ...(env.NODE_ENV === 'development' && appErr.status >= 500 && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return AppError.conflict(`A record with this ${target} already exists`);
    }
    case 'P2025':
      return AppError.notFound('Record not found');
    case 'P2003':
      return AppError.conflict('Operation violates a foreign-key constraint');
    default:
      return AppError.internal('Database error');
  }
}
