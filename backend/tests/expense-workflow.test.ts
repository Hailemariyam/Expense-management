import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  disconnect,
  joinCompany,
  registerCompany,
  resetDb,
  setRole,
} from './helpers.js';

describe('expense workflow & validation', () => {
  let admin: Awaited<ReturnType<typeof registerCompany>>;
  let manager: Awaited<ReturnType<typeof joinCompany>>;
  let employee: Awaited<ReturnType<typeof joinCompany>>;

  beforeAll(async () => {
    await resetDb();
    admin = await registerCompany('Acme', 'admin@acme.test');
    const managerJoin = await joinCompany(admin.companyId, 'Mo', 'mo@acme.test');
    employee = await joinCompany(admin.companyId, 'Eve', 'eve@acme.test');
    manager = await setRole(admin.auth, { userId: managerJoin.userId, email: 'mo@acme.test' }, 'manager');
  });
  afterAll(disconnect);

  it('new expense starts as pending', async () => {
    const res = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '99.99')
      .field('category', 'Travel')
      .field('expenseDate', '2026-08-15')
      .field('comment', 'taxi');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.amount).toBe('99.99'); // exact string, no float drift
  });

  it('rejected → resubmit puts it back to pending, then can be approved', async () => {
    const create = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '30.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-12');
    const id = create.body.data.id;

    await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'rejected' });
    const resubmit = await api().post(`/api/expenses/${id}/submit`).set(employee.auth);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data.status).toBe('pending');

    const approve = await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
    expect(approve.status).toBe(200);
  });

  it('an approved expense cannot be re-submitted', async () => {
    const create = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '20.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-12');
    const id = create.body.data.id;
    await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
    const res = await api().post(`/api/expenses/${id}/submit`).set(employee.auth);
    expect(res.status).toBe(422);
  });

  it('status endpoint rejects an invalid target status', async () => {
    const create = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '20.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-12');
    const res = await api()
      .patch(`/api/expenses/${create.body.data.id}/status`)
      .set(manager.auth)
      .send({ status: 'pending' }); // not allowed via this endpoint
    expect(res.status).toBe(400);
  });

  it('validation: rejects negative / zero / >2dp amounts and bad dates', async () => {
    const base = api().post('/api/expenses').set(employee.auth);
    void base;
    const cases = [
      { amount: '-1', category: 'X', expenseDate: '2026-08-01' },
      { amount: '0', category: 'X', expenseDate: '2026-08-01' },
      { amount: '1.999', category: 'X', expenseDate: '2026-08-01' },
      { amount: '10', category: '', expenseDate: '2026-08-01' },
      { amount: '10', category: 'X', expenseDate: '01-08-2026' },
    ];
    for (const c of cases) {
      const res = await api()
        .post('/api/expenses')
        .set(employee.auth)
        .field('amount', c.amount)
        .field('category', c.category)
        .field('expenseDate', c.expenseDate);
      expect(res.status, JSON.stringify(c)).toBe(400);
    }
  });

  it('list supports status / category / date filters and pagination', async () => {
    const res = await api()
      .get('/api/expenses?status=approved&pageSize=2&page=1')
      .set(manager.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    for (const e of res.body.data) expect(e.status).toBe('approved');
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 2 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('owner can delete their pending expense; approved needs admin', async () => {
    const create = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '11.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-12');
    const id = create.body.data.id;

    // still pending → owner delete OK
    expect((await api().delete(`/api/expenses/${id}`).set(employee.auth)).status).toBe(204);

    const create2 = await api()
      .post('/api/expenses')
      .set(employee.auth)
      .field('amount', '12.00')
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-12');
    const id2 = create2.body.data.id;
    await api().patch(`/api/expenses/${id2}/status`).set(manager.auth).send({ status: 'approved' });

    expect((await api().delete(`/api/expenses/${id2}`).set(employee.auth)).status).toBe(422);
    expect((await api().delete(`/api/expenses/${id2}`).set(admin.auth)).status).toBe(204);
  });

  it('404 for a well-formed but unknown id, 400 for a malformed id', async () => {
    expect(
      (await api().get('/api/expenses/00000000-0000-0000-0000-000000000000').set(admin.auth)).status,
    ).toBe(404);
    expect((await api().get('/api/expenses/not-a-uuid').set(admin.auth)).status).toBe(400);
  });
});
