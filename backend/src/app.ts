import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { mountApiDocs } from './docs/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

/**
 * Express application assembly (SOW §3):
 *   security headers → CORS → body parsing → request log
 *   → API docs (dev/staging) → /uploads static → /api routes
 *   → 404 → central error handler
 *
 * `createApp()` returns the app without listening, so tests can import it
 * directly with supertest.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI ships its own inline styles/scripts; relax CSP so the
      // /api/docs page renders. The API itself serves only JSON.
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // Interactive API docs at /api/docs (+ /api/docs.json). No-op in production.
  mountApiDocs(app);

  // Local receipt storage for this milestone (README §Receipt Upload).
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
      index: false,
      dotfiles: 'ignore',
      maxAge: '1h',
    }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
