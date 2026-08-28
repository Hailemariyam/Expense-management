import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, disconnect, login, registerCompany, resetDb } from './helpers.js';

beforeAll(resetDb);
afterAll(disconnect);

describe('auth', () => {
  it('registers a new company and makes the first user an admin', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@acme.test', password: 'Passw0rd!', companyName: 'Acme' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ada2', email: 'ada@acme.test', password: 'Passw0rd!', companyName: 'Acme2' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects registration without exactly one of companyName / companyId', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'X', email: 'x@x.test', password: 'Passw0rd!' });
    expect(res.status).toBe(400);
  });

  it('joins an existing company as an employee', async () => {
    const admin = await login('ada@acme.test');
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Joe', email: 'joe@acme.test', password: 'Passw0rd!', companyId: admin.companyId });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('employee');
    expect(res.body.data.user.companyId).toBe(admin.companyId);
  });

  it('logs in and rejects wrong passwords with 401', async () => {
    const good = await api().post('/api/auth/login').send({ email: 'ada@acme.test', password: 'Passw0rd!' });
    expect(good.status).toBe(200);

    const bad = await api().post('/api/auth/login').send({ email: 'ada@acme.test', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user from /auth/me', async () => {
    const actor = await login('joe@acme.test');
    const res = await api().get('/api/auth/me').set(actor.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('joe@acme.test');
    expect(res.body.data.role).toBe('employee');
  });

  it('rejects requests with no / invalid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set({ Authorization: 'Bearer garbage' })).status).toBe(401);
  });

  it('rotates refresh tokens and invalidates the old one', async () => {
    const actor = await registerCompany('RotCo', 'rot@rot.test');

    const r1 = await api().post('/api/auth/refresh').send({ refreshToken: actor.refreshToken });
    expect(r1.status).toBe(200);
    const newRt = r1.body.data.refreshToken as string;
    expect(newRt).not.toBe(actor.refreshToken);

    // old one is now revoked
    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: actor.refreshToken });
    expect(reuse.status).toBe(401);

    // new one still works
    const r2 = await api().post('/api/auth/refresh').send({ refreshToken: newRt });
    expect(r2.status).toBe(200);
  });

  it('logout revokes the refresh token', async () => {
    const actor = await registerCompany('LogoutCo', 'lo@lo.test');
    const out = await api().post('/api/auth/logout').set(actor.auth).send({ refreshToken: actor.refreshToken });
    expect(out.status).toBe(200);
    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: actor.refreshToken });
    expect(reuse.status).toBe(401);
  });
});
