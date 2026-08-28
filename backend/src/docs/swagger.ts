import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env.js';
import { buildOpenApiDocument } from './openapi.js';

/**
 * Mounts interactive API docs — dev / staging only. Skipped entirely in
 * production so the full API surface isn't advertised publicly.
 *
 *   GET /api/docs        Swagger UI
 *   GET /api/docs.json   raw OpenAPI 3.1 document
 */
export function mountApiDocs(app: Express): void {
  if (env.NODE_ENV === 'production') return;

  const document = buildOpenApiDocument();

  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.json(document);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Expense Management API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
}
