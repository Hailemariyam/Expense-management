import type { User, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { companyRepository } from '../repositories/company.repository.js';
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    companyId: u.companyId,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export const authService = {
  /**
   * Register a brand-new user. Two mutually exclusive modes:
   *   - { companyName }   → create a new company; this user becomes its 'admin'
   *   - { companyId }     → join an existing company as 'employee'
   *
   * The very first user of a new company is always the admin (SOW: an admin
   * must exist to manage users). Joiners are employees; an admin promotes them.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    companyId?: string;
  }): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw AppError.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      let companyId: string;
      let role: UserRole;

      if (input.companyName) {
        const company = await companyRepository.create(input.companyName, tx);
        companyId = company.id;
        role = 'admin';
      } else if (input.companyId) {
        const company = await tx.company.findUnique({ where: { id: input.companyId } });
        if (!company) throw AppError.notFound('Company to join was not found');
        companyId = company.id;
        role = 'employee';
      } else {
        throw AppError.badRequest('Provide either companyName (create) or companyId (join)');
      }

      return userRepository.create(
        { companyId, name: input.name, email: input.email, passwordHash, role },
        tx,
      );
    });

    return this.issueTokens(user);
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await userRepository.findByEmail(email);
    // Uniform failure — don't reveal whether the email exists.
    if (!user) {
      // Still spend ~a hash to reduce timing signal.
      await verifyPassword(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
      throw AppError.invalidCredentials();
    }
    const okPw = await verifyPassword(password, user.passwordHash);
    if (!okPw) throw AppError.invalidCredentials();

    return this.issueTokens(user);
  },

  /** Refresh-token rotation: validate → revoke old → issue new pair. */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const payload = verifyRefreshToken(rawRefreshToken);
    const stored = await refreshTokenRepository.findLiveByHash(hashToken(rawRefreshToken));
    if (!stored || stored.userId !== payload.sub) {
      throw AppError.unauthenticated('Refresh token is not recognised or has been revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw AppError.unauthenticated('User no longer exists');

    const next = signRefreshToken(user.id);
    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.revokeById(stored.id, tx);
      await refreshTokenRepository.create(
        { userId: user.id, tokenHash: next.tokenHash, expiresAt: next.expiresAt },
        tx,
      );
    });

    return {
      user: toPublicUser(user),
      accessToken: signAccessToken({ userId: user.id, companyId: user.companyId, role: user.role }),
      refreshToken: next.token,
    };
  },

  async logout(rawRefreshToken: string | undefined, userId: string): Promise<void> {
    if (rawRefreshToken) {
      const stored = await refreshTokenRepository.findLiveByHash(hashToken(rawRefreshToken));
      if (stored && stored.userId === userId) {
        await refreshTokenRepository.revokeById(stored.id);
        return;
      }
    }
    // Fallback: revoke all sessions for the user.
    await refreshTokenRepository.revokeAllForUser(userId);
  },

  async me(userId: string, companyId: string): Promise<PublicUser> {
    const user = await userRepository.findByIdInCompany(userId, companyId);
    if (!user) throw AppError.unauthenticated('User no longer exists');
    return toPublicUser(user);
  },

  async issueTokens(user: User): Promise<AuthResult> {
    const refresh = signRefreshToken(user.id);
    await refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });
    return {
      user: toPublicUser(user),
      accessToken: signAccessToken({
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
      }),
      refreshToken: refresh.token,
    };
  },
};
