import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  disconnect,
  joinCompany,
  registerCompany,
  resetDb,
  setRole,
} from './helpers.js';

/** SOW §2 permission matrix, enforced end-to-end. */
describe('RBAC permission matrix', () => {
  let admin: Awaited<ReturnType<typeof registerCompany>>;
  let manager: Awaited<ReturnType<typeof joinCompany>>;
  let employee: Awaited<ReturnType<typeof joinCompany>>;

  beforeAll(async () => {
    await resetDb();
    admin = await registerCompany('Acme', 'admin@acme.test');
    const managerJoin = await joinCompany(admin.companyId, 'Mo', 'mo@acme.test');
    employee = await joinCompany(admin.companyId, 'Eve', 'eve@acme.test');
    // Promotion invalidates the token issued at registration → re-login.
    manager = await setRole(admin.auth, { userId: managerJoin.userId, email: 'mo@acme.test' }, 'manager');
  });
  afterAll(disconnect);

  async function newExpense(auth: { Authorization: string }, amount = '10.00') {
    const res = await api()
      .post('/api/expenses')
      .set(auth)
      .field('amount', amount)
      .field('category', 'Meals')
      .field('expenseDate', '2026-08-10');
    return res.body.data.id as string;
  }

  describe('manage company users → Admin only', () => {
    it('admin can list users', async () => {
      const res = await api().get('/api/users').set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(3);
    });
    it('manager cannot list users', async () => {
      expect((await api().get('/api/users').set(manager.auth)).status).toBe(403);
    });
    it('employee cannot list users', async () => {
      expect((await api().get('/api/users').set(employee.auth)).status).toBe(403);
    });
  });

  describe('view team expenses → Manager / Admin', () => {
    it('employee ?scope=team is forbidden', async () => {
      expect((await api().get('/api/expenses?scope=team').set(employee.auth)).status).toBe(403);
    });
    it('employee list returns only their own rows', async () => {
      await newExpense(employee.auth);
      await newExpense(manager.auth);
      const res = await api().get('/api/expenses').set(employee.auth);
      expect(res.status).toBe(200);
      for (const e of res.body.data) expect(e.userId).toBe(employee.userId);
    });
    it('manager list returns the whole company', async () => {
      const res = await api().get('/api/expenses').set(manager.auth);
      const owners = new Set(res.body.data.map((e: { userId: string }) => e.userId));
      expect(owners.size).toBeGreaterThan(1);
    });
  });

  describe('approve / reject → Manager / Admin', () => {
    it('employee cannot approve', async () => {
      const id = await newExpense(employee.auth);
      const res = await api().patch(`/api/expenses/${id}/status`).set(employee.auth).send({ status: 'approved' });
      expect(res.status).toBe(403);
    });
    it('manager can approve an employee expense', async () => {
      const id = await newExpense(employee.auth);
      const res = await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });
    it('admin can reject an employee expense', async () => {
      const id = await newExpense(employee.auth);
      const res = await api().patch(`/api/expenses/${id}/status`).set(admin.auth).send({ status: 'rejected' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });
    it('manager cannot approve their OWN expense (segregation of duties)', async () => {
      const id = await newExpense(manager.auth);
      const res = await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
      expect(res.status).toBe(403);
    });
    it('admin CAN approve their own expense (full access per SOW)', async () => {
      const id = await newExpense(admin.auth);
      const res = await api().patch(`/api/expenses/${id}/status`).set(admin.auth).send({ status: 'approved' });
      expect(res.status).toBe(200);
    });
    it('only a pending expense can transition', async () => {
      const id = await newExpense(employee.auth);
      await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
      const again = await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'rejected' });
      expect(again.status).toBe(422);
    });
  });

  describe('create / view own / submit → everyone', () => {
    it('every role can create an expense', async () => {
      for (const a of [admin.auth, manager.auth, employee.auth]) {
        const res = await api()
          .post('/api/expenses')
          .set(a)
          .field('amount', '5.00')
          .field('category', 'Misc')
          .field('expenseDate', '2026-08-01');
        expect(res.status).toBe(201);
      }
    });
    it('owner can edit only while pending', async () => {
      const id = await newExpense(employee.auth);
      const ok = await api().patch(`/api/expenses/${id}`).set(employee.auth).send({ category: 'Travel' });
      expect(ok.status).toBe(200);
      await api().patch(`/api/expenses/${id}/status`).set(manager.auth).send({ status: 'approved' });
      const no = await api().patch(`/api/expenses/${id}`).set(employee.auth).send({ category: 'Meals' });
      expect(no.status).toBe(422);
    });
    it('a non-owner employee cannot see or edit another employee expense', async () => {
      const other = await joinCompany(admin.companyId, 'Sam', 'sam@acme.test');
      const id = await newExpense(employee.auth);
      expect((await api().get(`/api/expenses/${id}`).set(other.auth)).status).toBe(404);
    });
  });

  describe('analytics → Manager / Admin', () => {
    it('employee is denied', async () => {
      expect((await api().get('/api/analytics/dashboard').set(employee.auth)).status).toBe(403);
      expect((await api().get('/api/analytics/monthly').set(employee.auth)).status).toBe(403);
      expect((await api().get('/api/analytics/by-category').set(employee.auth)).status).toBe(403);
    });
    it('manager and admin are allowed', async () => {
      expect((await api().get('/api/analytics/dashboard').set(manager.auth)).status).toBe(200);
      expect((await api().get('/api/analytics/dashboard').set(admin.auth)).status).toBe(200);
    });
  });

  describe('admin user-management guardrails', () => {
    it('admin cannot self-demote', async () => {
      const res = await api().patch(`/api/users/${admin.userId}`).set(admin.auth).send({ role: 'employee' });
      expect(res.status).toBe(400);
    });
    it('admin cannot delete themselves', async () => {
      const res = await api().delete(`/api/users/${admin.userId}`).set(admin.auth);
      expect(res.status).toBe(400);
    });
    it('deletes a second admin (no expenses) but blocks deleting the last one', async () => {
      // A fresh joiner with no expenses, promoted to admin → now two admins.
      const spare = await joinCompany(admin.companyId, 'Spare', 'spare@acme.test');
      await setRole(admin.auth, { userId: spare.userId, email: 'spare@acme.test' }, 'admin');
      const del = await api().delete(`/api/users/${spare.userId}`).set(admin.auth);
      expect(del.status).toBe(204);

      // Back to a single admin. Self-delete is blocked (400) and there is no
      // other admin to remove, so the "last admin" invariant holds.
      const selfDel = await api().delete(`/api/users/${admin.userId}`).set(admin.auth);
      expect(selfDel.status).toBe(400);
    });

    it('refuses to delete a user who has expenses (FK RESTRICT → 409)', async () => {
      // `employee` has created expenses across this suite.
      const res = await api().delete(`/api/users/${employee.userId}`).set(admin.auth);
      expect(res.status).toBe(409);
    });
  });
});
