import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

export const app: Express = createApp();
export const api = () => request(app);

/** Wipe all data between test files. Order respects FK (RESTRICT) constraints. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE refresh_tokens, expenses, users, companies RESTART IDENTITY CASCADE',
  );
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

interface RegisteredActor {
  accessToken: string;
  refreshToken: string;
  userId: string;
  companyId: string;
  auth: { Authorization: string };
}

/** Register a fresh company; the returned actor is its admin. */
export async function registerCompany(
  companyName: string,
  email: string,
  password = 'Passw0rd!',
): Promise<RegisteredActor> {
  const res = await api()
    .post('/api/auth/register')
    .send({ name: `Admin ${companyName}`, email, password, companyName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  return actorFrom(res.body.data);
}

/** Register a user that joins an existing company (role: employee). */
export async function joinCompany(
  companyId: string,
  name: string,
  email: string,
  password = 'Passw0rd!',
): Promise<RegisteredActor> {
  const res = await api()
    .post('/api/auth/register')
    .send({ name, email, password, companyId });
  if (res.status !== 201) throw new Error(`join failed: ${res.status} ${res.text}`);
  return actorFrom(res.body.data);
}

export async function login(email: string, password = 'Passw0rd!'): Promise<RegisteredActor> {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.text}`);
  return actorFrom(res.body.data);
}

/**
 * Promote a company user to a role, acting as an admin, then return a FRESH
 * actor for that user. A role change does not rewrite tokens already issued —
 * the user must obtain a new access token (login or refresh) for the new role
 * to take effect. Tests must use the returned actor, not the pre-promotion one.
 */
export async function setRole(
  adminAuth: { Authorization: string },
  user: { userId: string; email: string },
  role: 'employee' | 'manager' | 'admin',
  password = 'Passw0rd!',
): Promise<RegisteredActor> {
  const res = await api().patch(`/api/users/${user.userId}`).set(adminAuth).send({ role });
  if (res.status !== 200) throw new Error(`setRole failed: ${res.status} ${res.text}`);
  return login(user.email, password);
}

function actorFrom(data: {
  accessToken: string;
  refreshToken: string;
  user: { id: string; companyId: string };
}): RegisteredActor {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    companyId: data.user.companyId,
    auth: { Authorization: `Bearer ${data.accessToken}` },
  };
}
