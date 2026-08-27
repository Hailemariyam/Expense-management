import { companyRepository } from '../repositories/company.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';

/**
 * Company operations that happen *after* registration. Creating/joining a
 * company as part of sign-up lives in auth.service; this covers "look at my
 * company" and (admin) rename.
 */
export const companyService = {
  async getMine(companyId: string) {
    const company = await companyRepository.findById(companyId);
    if (!company) throw AppError.notFound('Company not found');
    const userCount = await userRepository.countByCompany(companyId);
    return { ...company, userCount };
  },

  /**
   * Join flow for an already-authenticated user is intentionally NOT supported
   * — a user belongs to exactly one company, set at registration. Switching
   * companies would be a re-registration. This method exists to make that
   * explicit rather than leaving a tempting gap.
   */
  joinNotSupported(): never {
    throw AppError.badRequest(
      'An existing account cannot switch companies. Company is chosen at registration ' +
        '(POST /api/auth/register with companyId to join).',
    );
  },

  async rename(companyId: string, name: string) {
    return companyRepository.update(companyId, { name });
  },
};
