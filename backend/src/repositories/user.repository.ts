import type { Prisma, User } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/**
 * Data access for `users`.
 *
 * TENANT ISOLATION RULE: every method that reads or mutates a user by id also
 * takes `companyId` and filters on it. The only exception is `findByEmail`,
 * used exclusively by login *before* a tenant context exists — email is
 * globally unique, so this cannot cross tenants improperly.
 */
export const userRepository = {
  /** Login lookup only — no tenant context yet. */
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  /** Tenant-scoped: returns null if the user exists but in another company. */
  findByIdInCompany(id: string, companyId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, companyId } });
  },

  listByCompany(
    companyId: string,
    opts: { skip?: number; take?: number } = {},
  ): Promise<User[]> {
    return prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      skip: opts.skip,
      take: opts.take,
    });
  },

  countByCompany(companyId: string): Promise<number> {
    return prisma.user.count({ where: { companyId } });
  },

  create(
    data: {
      companyId: string;
      name: string;
      email: string;
      passwordHash: string;
      role: Prisma.UserCreateInput['role'];
    },
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<User> {
    return tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        company: { connect: { id: data.companyId } },
      },
    });
  },

  /** Tenant-scoped update. Uses updateMany + count so a cross-tenant id is a no-op. */
  async updateInCompany(
    id: string,
    companyId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<User | null> {
    const res = await prisma.user.updateMany({ where: { id, companyId }, data });
    if (res.count === 0) return null;
    return prisma.user.findUnique({ where: { id } });
  },

  /** Tenant-scoped delete. Returns the number of rows removed (0 or 1). */
  async deleteInCompany(id: string, companyId: string): Promise<number> {
    const res = await prisma.user.deleteMany({ where: { id, companyId } });
    return res.count;
  },
};
