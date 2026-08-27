import type { Expense, ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface ExpenseListFilter {
  companyId: string;
  /** When set, restrict to this owner (employees see only their own). */
  userId?: string;
  status?: ExpenseStatus;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
}

/**
 * Data access for `expenses`.
 *
 * TENANT ISOLATION RULE: `companyId` is a required argument on every read and
 * write. There is deliberately no `findById(id)` overload without it — the
 * guide (§4) calls that out as the incorrect pattern.
 */
export const expenseRepository = {
  create(
    data: {
      companyId: string;
      userId: string;
      amount: Prisma.Decimal | string | number;
      category: string;
      expenseDate: Date;
      comment?: string | null;
      receiptUrl?: string | null;
    },
  ): Promise<Expense> {
    return prisma.expense.create({
      data: {
        amount: data.amount,
        category: data.category,
        expenseDate: data.expenseDate,
        comment: data.comment ?? null,
        receiptUrl: data.receiptUrl ?? null,
        company: { connect: { id: data.companyId } },
        user: { connect: { id: data.userId } },
      },
    });
  },

  /** Tenant-scoped fetch. Returns null for a foreign-tenant id. */
  findByIdInCompany(id: string, companyId: string): Promise<Expense | null> {
    return prisma.expense.findFirst({ where: { id, companyId } });
  },

  list(filter: ExpenseListFilter): Promise<Expense[]> {
    return prisma.expense.findMany({
      where: buildWhere(filter),
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: filter.skip,
      take: filter.take,
    });
  },

  count(filter: ExpenseListFilter): Promise<number> {
    return prisma.expense.count({ where: buildWhere(filter) });
  },

  /** Tenant-scoped update of editable fields (owner, draft/pending only — enforced in service). */
  async updateInCompany(
    id: string,
    companyId: string,
    data: Prisma.ExpenseUpdateInput,
  ): Promise<Expense | null> {
    const res = await prisma.expense.updateMany({ where: { id, companyId }, data });
    if (res.count === 0) return null;
    return prisma.expense.findUnique({ where: { id } });
  },

  async setStatusInCompany(
    id: string,
    companyId: string,
    status: ExpenseStatus,
  ): Promise<Expense | null> {
    const res = await prisma.expense.updateMany({ where: { id, companyId }, data: { status } });
    if (res.count === 0) return null;
    return prisma.expense.findUnique({ where: { id } });
  },

  async deleteInCompany(id: string, companyId: string): Promise<number> {
    const res = await prisma.expense.deleteMany({ where: { id, companyId } });
    return res.count;
  },

  // ---- Analytics (all company-scoped) ----

  /** Sum + count grouped by YYYY-MM for the company, over the last `months`. */
  monthlyTotals(companyId: string, months: number): Promise<
    { month: string; total: string; count: number }[]
  > {
    // `months` is validated (int, 1..24) upstream; interpolate it as a literal
    // count of months so the interval type is unambiguous to Postgres.
    const window = Math.trunc(months);
    return prisma.$queryRawUnsafe(
      `
      SELECT to_char(date_trunc('month', expense_date), 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0)::text                        AS total,
             COUNT(*)::int                                         AS count
      FROM expenses
      WHERE company_id = $1::uuid
        AND expense_date >= (date_trunc('month', now()) - ($2 || ' months')::interval)
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      companyId,
      String(window),
    );
  },

  byCategory(
    companyId: string,
    opts: { dateFrom?: Date; dateTo?: Date } = {},
  ): Promise<{ category: string; total: string; count: number }[]> {
    const from = opts.dateFrom ?? new Date('1970-01-01');
    const to = opts.dateTo ?? new Date('9999-12-31');
    return prisma.$queryRaw`
      SELECT category,
             COALESCE(SUM(amount), 0)::text AS total,
             COUNT(*)::int                  AS count
      FROM expenses
      WHERE company_id = ${companyId}::uuid
        AND expense_date BETWEEN ${from} AND ${to}
      GROUP BY category
      ORDER BY SUM(amount) DESC
    `;
  },

  /** Status counts + total pending/approved value for the dashboard headline. */
  summary(companyId: string): Promise<
    { status: ExpenseStatus; count: number; total: string }[]
  > {
    return prisma.$queryRaw`
      SELECT status,
             COUNT(*)::int                  AS count,
             COALESCE(SUM(amount), 0)::text AS total
      FROM expenses
      WHERE company_id = ${companyId}::uuid
      GROUP BY status
    `;
  },
};

function buildWhere(f: ExpenseListFilter): Prisma.ExpenseWhereInput {
  return {
    companyId: f.companyId,
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.dateFrom || f.dateTo
      ? {
          expenseDate: {
            ...(f.dateFrom ? { gte: f.dateFrom } : {}),
            ...(f.dateTo ? { lte: f.dateTo } : {}),
          },
        }
      : {}),
  };
}
