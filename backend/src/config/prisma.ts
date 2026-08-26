import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * Single shared PrismaClient instance.
 *
 * Architectural note: this module is the ONLY place the Prisma client is
 * constructed. Services never import it — they go through repository classes,
 * which keeps the data-access concern confined to the repository layer
 * (clean architecture / separation of layers, per the SOW).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : env.NODE_ENV === 'test'
          ? []
          : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
