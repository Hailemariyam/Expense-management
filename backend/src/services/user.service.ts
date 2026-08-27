import type { UserRole } from '@prisma/client';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword } from '../utils/password.js';
import { toPublicUser, type PublicUser } from './auth.service.js';
import type { AuthContext } from '../types/auth.js';

/**
 * Admin-only company user management (SOW §2: "Manage company users" — Admin).
 * Every method is company-scoped through the repository; an admin of company A
 * can never touch company B's users even by guessing an id.
 */
export const userService = {
  async list(
    companyId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PublicUser[]; total: number }> {
    const [rows, total] = await Promise.all([
      userRepository.listByCompany(companyId, {
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      userRepository.countByCompany(companyId),
    ]);
    return { items: rows.map(toPublicUser), total };
  },

  async getById(id: string, companyId: string): Promise<PublicUser> {
    const user = await userRepository.findByIdInCompany(id, companyId);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },

  /**
   * Update a user's name / role / password. Guardrails:
   *  - an admin cannot demote themselves (avoids locking the company out of
   *    user management); they must promote someone else first.
   */
  async update(
    targetId: string,
    actor: AuthContext,
    patch: { name?: string; role?: UserRole; password?: string },
  ): Promise<PublicUser> {
    const target = await userRepository.findByIdInCompany(targetId, actor.companyId);
    if (!target) throw AppError.notFound('User not found');

    if (targetId === actor.userId && patch.role && patch.role !== 'admin') {
      throw AppError.badRequest(
        'You cannot remove your own admin role. Promote another user to admin first.',
      );
    }

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.password !== undefined) data.passwordHash = await hashPassword(patch.password);

    const updated = await userRepository.updateInCompany(targetId, actor.companyId, data);
    if (!updated) throw AppError.notFound('User not found');
    return toPublicUser(updated);
  },

  /**
   * Delete a company user. Guardrails:
   *  - cannot delete yourself
   *  - cannot delete the last admin
   *  - FK is ON DELETE RESTRICT, so a user with expenses cannot be deleted;
   *    that surfaces as a 409 from the Prisma error mapper.
   */
  async remove(targetId: string, actor: AuthContext): Promise<void> {
    if (targetId === actor.userId) {
      throw AppError.badRequest('You cannot delete your own account.');
    }
    const target = await userRepository.findByIdInCompany(targetId, actor.companyId);
    if (!target) throw AppError.notFound('User not found');

    if (target.role === 'admin') {
      const admins = (await userRepository.listByCompany(actor.companyId)).filter(
        (u) => u.role === 'admin',
      );
      if (admins.length <= 1) {
        throw AppError.badRequest('Cannot delete the last remaining admin.');
      }
    }

    const count = await userRepository.deleteInCompany(targetId, actor.companyId);
    if (count === 0) throw AppError.notFound('User not found');
  },
};
