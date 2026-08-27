import type { Prisma, RefreshToken } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/**
 * Data access for `refresh_tokens`. Tokens are stored hashed (SHA-256). On
 * every refresh we look up by hash, verify it's live (not revoked, not
 * expired), revoke it, and issue a new one — rotation.
 */
export const refreshTokenRepository = {
  create(
    data: { userId: string; tokenHash: string; expiresAt: Date },
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<RefreshToken> {
    return tx.refreshToken.create({ data });
  },

  findLiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  revokeById(id: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<unknown> {
    return tx.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },

  /** Logout / "revoke everywhere": kill all of a user's live refresh tokens. */
  revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
