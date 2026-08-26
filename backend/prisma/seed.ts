/**
 * Seed data: one company with an admin, a manager, and an employee, plus a
 * spread of expenses across statuses/categories/months so the dashboard and
 * analytics endpoints have something to show.
 *
 * Idempotent: re-running upserts the users and only tops up expenses if none exist.
 *
 *   npm run seed
 */
import 'dotenv/config';
import { PrismaClient, Prisma, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CFG = {
  companyName: process.env.SEED_COMPANY_NAME ?? 'Acme Inc',
  admin: {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@acme.test',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Passw0rd!',
    name: 'Ada Admin',
  },
  manager: {
    email: process.env.SEED_MANAGER_EMAIL ?? 'manager@acme.test',
    password: process.env.SEED_MANAGER_PASSWORD ?? 'Passw0rd!',
    name: 'Mo Manager',
  },
  employee: {
    email: process.env.SEED_EMPLOYEE_EMAIL ?? 'employee@acme.test',
    password: process.env.SEED_EMPLOYEE_PASSWORD ?? 'Passw0rd!',
    name: 'Eve Employee',
  },
};

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

async function upsertUser(
  companyId: string,
  who: { email: string; password: string; name: string },
  role: UserRole,
) {
  const passwordHash = await bcrypt.hash(who.password, ROUNDS);
  return prisma.user.upsert({
    where: { email: who.email },
    update: { name: who.name, role, passwordHash, companyId },
    create: { email: who.email, name: who.name, role, passwordHash, companyId },
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Date(d.toISOString().slice(0, 10));
}

async function main() {
  // One company. (No natural unique key on name, so find-or-create.)
  let company = await prisma.company.findFirst({ where: { name: CFG.companyName } });
  company ??= await prisma.company.create({ data: { name: CFG.companyName } });

  const admin = await upsertUser(company.id, CFG.admin, 'admin');
  const manager = await upsertUser(company.id, CFG.manager, 'manager');
  const employee = await upsertUser(company.id, CFG.employee, 'employee');

  const existing = await prisma.expense.count({ where: { companyId: company.id } });
  if (existing === 0) {
    const rows: Prisma.ExpenseCreateManyInput[] = [
      { userId: employee.id, amount: '42.50', category: 'Meals', expenseDate: daysAgo(2), comment: 'Client lunch', status: 'pending' },
      { userId: employee.id, amount: '120.00', category: 'Travel', expenseDate: daysAgo(9), comment: 'Train tickets', status: 'approved' },
      { userId: employee.id, amount: '15.99', category: 'Software', expenseDate: daysAgo(20), comment: 'Monthly SaaS', status: 'approved' },
      { userId: employee.id, amount: '300.00', category: 'Travel', expenseDate: daysAgo(38), comment: 'Hotel', status: 'rejected' },
      { userId: manager.id, amount: '89.00', category: 'Office', expenseDate: daysAgo(5), comment: 'Desk lamp', status: 'pending' },
      { userId: manager.id, amount: '55.00', category: 'Meals', expenseDate: daysAgo(33), comment: 'Team dinner', status: 'approved' },
      { userId: admin.id, amount: '210.75', category: 'Software', expenseDate: daysAgo(48), comment: 'Annual license', status: 'approved' },
      { userId: employee.id, amount: '12.00', category: 'Meals', expenseDate: daysAgo(1), status: 'pending' },
    ].map((r) => ({ ...r, companyId: company!.id }));

    await prisma.expense.createMany({ data: rows });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded company "${company.name}"\n` +
      `  admin:    ${CFG.admin.email} / ${CFG.admin.password}\n` +
      `  manager:  ${CFG.manager.email} / ${CFG.manager.password}\n` +
      `  employee: ${CFG.employee.email} / ${CFG.employee.password}\n` +
      `  expenses: ${await prisma.expense.count({ where: { companyId: company.id } })}`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
