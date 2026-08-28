import { describe, expect, it } from 'vitest';
import { api } from './helpers.js';

/**
 * The OpenAPI document and Swagger UI are mounted for non-production
 * environments (NODE_ENV=test here). These checks guard that the spec keeps
 * generating and stays structurally sane as routes change.
 */
describe('API docs', () => {
  it('serves the OpenAPI 3.1 document at /api/docs.json', async () => {
    const res = await api().get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info.title).toMatch(/Expense Management/i);
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it('documents every mounted resource', async () => {
    const { body } = await api().get('/api/docs.json');
    const paths = Object.keys(body.paths);
    for (const p of [
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/me',
      '/companies/me',
      '/users',
      '/users/{id}',
      '/expenses',
      '/expenses/{id}',
      '/expenses/{id}/submit',
      '/expenses/{id}/status',
      '/analytics/dashboard',
      '/analytics/monthly',
      '/analytics/by-category',
      '/health',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
  });

  it('every operation has a unique operationId', async () => {
    const { body } = await api().get('/api/docs.json');
    const ids: string[] = [];
    for (const methods of Object.values(body.paths) as Record<string, { operationId?: string }>[]) {
      for (const op of Object.values(methods)) {
        expect(op.operationId, 'operation without operationId').toBeTruthy();
        ids.push(op.operationId as string);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks public auth routes as security: [] and protects the rest', async () => {
    const { body } = await api().get('/api/docs.json');
    expect(body.paths['/auth/login'].post.security).toEqual([]);
    expect(body.paths['/health'].get.security).toEqual([]);
    expect(body.paths['/expenses'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(body.paths['/users'].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it('serves the Swagger UI HTML at /api/docs/', async () => {
    const res = await api().get('/api/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
