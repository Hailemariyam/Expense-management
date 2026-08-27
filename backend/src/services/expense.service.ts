import { Prisma, type Expense, type ExpenseStatus } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import {
  expenseRepository,
  type ExpenseListFilter,
} from '../repositories/expense.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import type { AuthContext } from '../types/auth.js';

/** API-facing shape: Decimal → string so JSON stays exact. */
export interface ExpenseDTO {
  id: string;
  companyId: string;
  userId: string;
  amount: string;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  comment: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toDTO(e: Expense): ExpenseDTO {
  return {
    id: e.id,
    companyId: e.companyId,
    userId: e.userId,
    amount: e.amount.toString(),
    category: e.category,
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    comment: e.comment,
    receiptUrl: e.receiptUrl,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/** Whose expenses can this actor see? Employee → own only. Manager/Admin → whole company. */
function visibilityScope(actor: AuthContext): { userId?: string } {
  return actor.role === 'employee' ? { userId: actor.userId } : {};
}

export const expenseService = {
  async create(
    actor: AuthContext,
    input: {
      amount: string;
      category: string;
      expenseDate: string;
      comment?: string;
      receiptUrl?: string | null;
    },
  ): Promise<ExpenseDTO> {
    const created = await expenseRepository.create({
      companyId: actor.companyId,
      userId: actor.userId,
      amount: new Prisma.Decimal(input.amount),
      category: input.category,
      expenseDate: new Date(input.expenseDate),
      comment: input.comment ?? null,
      receiptUrl: input.receiptUrl ?? null,
    });
    return toDTO(created);
  },

  async list(
    actor: AuthContext,
    query: {
      scope?: 'me' | 'team';
      status?: ExpenseStatus;
      category?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: ExpenseDTO[]; total: number }> {
    // Base visibility from role, then optional narrowing via ?scope=me.
    const scope = visibilityScope(actor);
    if (query.scope === 'me') scope.userId = actor.userId;
    if (query.scope === 'team' && actor.role === 'employee') {
      throw AppError.forbidden('Employees cannot view team expenses');
    }

    const filter: ExpenseListFilter = {
      companyId: actor.companyId,
      ...scope,
      status: query.status,
      category: query.category,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    };

    const [rows, total] = await Promise.all([
      expenseRepository.list(filter),
      expenseRepository.count({ ...filter, skip: undefined, take: undefined }),
    ]);
    return { items: rows.map(toDTO), total };
  },

  async getById(actor: AuthContext, id: string): Promise<ExpenseDTO> {
    const expense = await this.loadVisible(actor, id);
    return toDTO(expense);
  },

  /**
   * Update editable fields. Only the owner may edit, and only while the expense
   * is still `pending` (nothing approved/rejected can be altered).
   */
  async update(
    actor: AuthContext,
    id: string,
    patch: {
      amount?: string;
      category?: string;
      expenseDate?: string;
      comment?: string | null;
      receiptUrl?: string | null;
    },
  ): Promise<ExpenseDTO> {
    const expense = await this.loadVisible(actor, id);
    if (expense.userId !== actor.userId) {
      throw AppError.forbidden('You can only edit your own expenses');
    }
    if (expense.status !== 'pending') {
      throw AppError.unprocessable(`A ${expense.status} expense can no longer be edited`);
    }

    const data: Prisma.ExpenseUpdateInput = {};
    if (patch.amount !== undefined) data.amount = new Prisma.Decimal(patch.amount);
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.expenseDate !== undefined) data.expenseDate = new Date(patch.expenseDate);
    if (patch.comment !== undefined) data.comment = patch.comment;
    if (patch.receiptUrl !== undefined) data.receiptUrl = patch.receiptUrl;

    const updated = await expenseRepository.updateInCompany(id, actor.companyId, data);
    if (!updated) throw AppError.notFound('Expense not found');
    return toDTO(updated);
  },

  /**
   * Submit-for-approval. In this minimal model an expense is created as
   * `pending` already, so "submit" is idempotent-ish: it's a no-op if already
   * pending, and rejected → pending is allowed (resubmit after fixing).
   * Approved expenses cannot be re-submitted.
   */
  async submit(actor: AuthContext, id: string): Promise<ExpenseDTO> {
    const expense = await this.loadVisible(actor, id);
    if (expense.userId !== actor.userId) {
      throw AppError.forbidden('You can only submit your own expenses');
    }
    if (expense.status === 'approved') {
      throw AppError.unprocessable('An approved expense cannot be re-submitted');
    }
    if (expense.status === 'pending') return toDTO(expense);

    const updated = await expenseRepository.setStatusInCompany(id, actor.companyId, 'pending');
    if (!updated) throw AppError.notFound('Expense not found');
    return toDTO(updated);
  },

  /**
   * Approve / reject — Manager or Admin only (route-gated by authorize()).
   * Validation order mirrors SOW §6:
   *   1. authenticated (middleware)      2. belongs to actor's company (loadVisible)
   *   3. actor is manager/admin (route)  4. target status is valid (validator)
   *   5. update
   * Extra rule: only a `pending` expense can transition; and a manager cannot
   * approve their own expense (segregation of duties) — admins may.
   */
  async setStatus(
    actor: AuthContext,
    id: string,
    status: Extract<ExpenseStatus, 'approved' | 'rejected'>,
  ): Promise<ExpenseDTO> {
    const expense = await expenseRepository.findByIdInCompany(id, actor.companyId);
    if (!expense) throw AppError.notFound('Expense not found');

    if (expense.status !== 'pending') {
      throw AppError.unprocessable(
        `Only a pending expense can be ${status}; this one is ${expense.status}`,
      );
    }
    if (actor.role === 'manager' && expense.userId === actor.userId) {
      throw AppError.forbidden('A manager cannot approve or reject their own expense');
    }

    const updated = await expenseRepository.setStatusInCompany(id, actor.companyId, status);
    if (!updated) throw AppError.notFound('Expense not found');
    return toDTO(updated);
  },

  async remove(actor: AuthContext, id: string): Promise<void> {
    const expense = await this.loadVisible(actor, id);
    const isOwner = expense.userId === actor.userId;
    const isAdmin = actor.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw AppError.forbidden('Only the owner or an admin can delete an expense');
    }
    if (expense.status === 'approved' && !isAdmin) {
      throw AppError.unprocessable('An approved expense can only be deleted by an admin');
    }

    await this.bestEffortDeleteReceipt(expense.receiptUrl);
    const count = await expenseRepository.deleteInCompany(id, actor.companyId);
    if (count === 0) throw AppError.notFound('Expense not found');
  },

  // ---- Analytics ----

  async monthly(companyId: string, months: number) {
    const rows = await expenseRepository.monthlyTotals(companyId, months);
    return rows.map((r) => ({ month: r.month, total: r.total, count: r.count }));
  },

  async byCategory(companyId: string, dateFrom?: string, dateTo?: string) {
    const rows = await expenseRepository.byCategory(companyId, {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    return rows.map((r) => ({ category: r.category, total: r.total, count: r.count }));
  },

  async dashboard(companyId: string) {
    const [summary, monthly] = await Promise.all([
      expenseRepository.summary(companyId),
      expenseRepository.monthlyTotals(companyId, 1),
    ]);

    const byStatus = Object.fromEntries(
      summary.map((s) => [s.status, { count: s.count, total: s.total }]),
    ) as Record<ExpenseStatus, { count: number; total: string }>;

    const thisMonth = monthly.at(-1) ?? { total: '0', count: 0 };
    return {
      monthTotal: thisMonth.total,
      monthCount: thisMonth.count,
      pending: byStatus.pending ?? { count: 0, total: '0' },
      approved: byStatus.approved ?? { count: 0, total: '0' },
      rejected: byStatus.rejected ?? { count: 0, total: '0' },
    };
  },

  // ---- helpers ----

  /** Load an expense the actor is allowed to *see* (own, or company-wide for mgr/admin). */
  async loadVisible(actor: AuthContext, id: string): Promise<Expense> {
    const expense = await expenseRepository.findByIdInCompany(id, actor.companyId);
    if (!expense) throw AppError.notFound('Expense not found');
    if (actor.role === 'employee' && expense.userId !== actor.userId) {
      // Same 404 as a foreign-tenant id — don't disclose existence.
      throw AppError.notFound('Expense not found');
    }
    return expense;
  },

  async bestEffortDeleteReceipt(receiptUrl: string | null): Promise<void> {
    if (!receiptUrl) return;
    try {
      const marker = '/uploads/';
      const idx = receiptUrl.indexOf(marker);
      if (idx === -1) return;
      const filename = path.basename(receiptUrl.slice(idx + marker.length));
      await fs.unlink(path.resolve(process.cwd(), env.UPLOAD_DIR, filename));
    } catch {
      /* file already gone or not local storage — ignore */
    }
  },

  /** Used by managers/admins to attribute a listed expense to a person. */
  async ownerLabel(userId: string, companyId: string): Promise<string | null> {
    const u = await userRepository.findByIdInCompany(userId, companyId);
    return u ? u.name : null;
  },
};
