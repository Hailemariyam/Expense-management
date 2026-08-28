import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, disconnect, joinCompany, registerCompany, resetDb } from './helpers.js';

/**
 * The central multi-tenancy guarantee: a user of company A can never read or
 * mutate a resource belonging to company B — regardless of role.
 */
describe('multi-tenant isolation', () => {
  let acmeAdmin: Awaited<ReturnType<typeof registerCompany>>;
  let acmeEmp: Awaited<ReturnType<typeof joinCompany>>;
  let globexAdmin: Awaited<ReturnType<typeof registerCompany>>;
  let acmeExpenseId: string;

  beforeAll(async () => {
    await resetDb();
    acmeAdmin = await registerCompany('Acme', 'admin@acme.test');
    acmeEmp = await joinCompany(acmeAdmin.companyId, 'Eve', 'eve@acme.test');
    globexAdmin = await registerCompany('Globex', 'admin@globex.test');

    const created = await api()
      .post('/api/expenses')
      .set(acmeEmp.auth)
      .field('amount', '50.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-01');
    acmeExpenseId = created.body.data.id;
  });
  afterAll(disconnect);

  it("Globex admin cannot read an Acme expense (404, not 403 — no existence disclosure)", async () => {
    const res = await api().get(`/api/expenses/${acmeExpenseId}`).set(globexAdmin.auth);
    expect(res.status).toBe(404);
  });

  it('Globex admin cannot change status of an Acme expense', async () => {
    const res = await api()
      .patch(`/api/expenses/${acmeExpenseId}/status`)
      .set(globexAdmin.auth)
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
  });

  it('Globex admin cannot delete an Acme expense', async () => {
    const res = await api().delete(`/api/expenses/${acmeExpenseId}`).set(globexAdmin.auth);
    expect(res.status).toBe(404);
  });

  it("Globex admin's expense list never contains Acme rows", async () => {
    const res = await api().get('/api/expenses').set(globexAdmin.auth);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.data).toHaveLength(0);
  });

  it('Globex admin cannot read or modify an Acme user', async () => {
    const read = await api().get(`/api/users/${acmeEmp.userId}`).set(globexAdmin.auth);
    expect(read.status).toBe(404);

    const patch = await api()
      .patch(`/api/users/${acmeEmp.userId}`)
      .set(globexAdmin.auth)
      .send({ role: 'admin' });
    expect(patch.status).toBe(404);
  });

  it('Globex admin sees only its own company from /companies/me', async () => {
    const res = await api().get('/api/companies/me').set(globexAdmin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Globex');
    expect(res.body.data.id).toBe(globexAdmin.companyId);
    expect(res.body.data.id).not.toBe(acmeAdmin.companyId);
  });

  it('analytics is scoped per company', async () => {
    const acme = await api().get('/api/analytics/dashboard').set(acmeAdmin.auth);
    const globex = await api().get('/api/analytics/dashboard').set(globexAdmin.auth);
    expect(Number(acme.body.data.pending.count)).toBeGreaterThan(0);
    expect(Number(globex.body.data.pending.count)).toBe(0);
  });
});
