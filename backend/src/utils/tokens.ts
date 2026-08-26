import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type {
  AccessTokenPayload,
  AuthContext,
  RefreshTokenPayload,
} from '../types/auth.js';
import { AppError } from './AppError.js';

/** Mint a short-lived access token carrying the tenant + role context. */
export function signAccessToken(ctx: AuthContext): string {
  const payload: AccessTokenPayload = {
    sub: ctx.userId,
    companyId: ctx.companyId,
    role: ctx.role,
    type: 'access',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

/**
 * Mint a refresh token. Returns the signed JWT plus its `jti` and a SHA-256
 * hash of the token — only the hash is persisted (refresh_tokens.token_hash),
 * so a DB leak does not hand out usable refresh tokens.
 */
export function signRefreshToken(userId: string): {
  token: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const jti = crypto.randomUUID();
  const payload: RefreshTokenPayload = { sub: userId, jti, type: 'refresh' };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);

  const decoded = jwt.decode(token) as { exp: number };
  return {
    token,
    jti,
    tokenHash: hashToken(token),
    expiresAt: new Date(decoded.exp * 1000),
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') throw AppError.unauthenticated('Wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
    }
    throw AppError.unauthenticated('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') throw AppError.unauthenticated('Wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token expired');
    }
    throw AppError.unauthenticated('Invalid refresh token');
  }
}
