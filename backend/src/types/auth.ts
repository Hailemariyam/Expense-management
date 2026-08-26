import type { UserRole } from '@prisma/client';

/**
 * The authenticated principal attached to every request that passes the
 * `authenticate` middleware. This is the *tenant + role context* every
 * downstream layer relies on:
 *   - companyId scopes all repository queries (multi-tenant isolation)
 *   - role drives RBAC checks
 */
export interface AuthContext {
  userId: string;
  companyId: string;
  role: UserRole;
}

/** JWT access-token payload (mirrors AuthContext + standard claims). */
export interface AccessTokenPayload {
  sub: string; // userId
  companyId: string;
  role: UserRole;
  type: 'access';
}

/** JWT refresh-token payload. Deliberately minimal — no role/company. */
export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // unique token id, also stored (hashed) in refresh_tokens
  type: 'refresh';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `authenticate`. Absent on public routes. */
      auth?: AuthContext;
    }
  }
}
