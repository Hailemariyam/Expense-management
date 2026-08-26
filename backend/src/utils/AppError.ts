/**
 * Application-level error with an HTTP status and a stable machine-readable code.
 * Thrown anywhere in the service/repository/controller layers; translated into a
 * JSON response by the central error handler (src/middleware/errorHandler.ts).
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'INTERNAL';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static invalidCredentials(message = 'Invalid email or password') {
    return new AppError(401, 'INVALID_CREDENTIALS', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, 'UNPROCESSABLE', message, details);
  }
  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL', message);
  }
}
