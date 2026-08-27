import type { Company, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/**
 * Data access for `companies`. Companies are the tenant boundary itself, so
 * these methods are not company-scoped — but everything downstream that touches
 * company-owned rows IS (see user/expense repositories).
 */
export const companyRepository = {
  create(name: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Company> {
    return tx.company.create({ data: { name } });
  },

  findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return prisma.company.update({ where: { id }, data });
  },
};
