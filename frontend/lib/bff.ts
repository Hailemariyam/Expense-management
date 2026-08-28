/**
 * BFF (backend-for-frontend) helpers shared by the /bff route handlers and the
 * auth route handlers.
 *
 * Token model:
 *  - The refresh token lives ONLY in an httpOnly, SameSite=Lax cookie
 *    (`em_rt`). The browser JS never sees it.
 *  - The access token is returned to the client in the JSON body of
 *    /bff/auth/login|register|refresh and held in memory (React context).
 *  - Every proxied API call carries the access token as a Bearer header,
 *    added here server-side from the `Authorization` the client sends.
 */
import { cookies } from 'next/headers';

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
export const REFRESH_COOKIE = 'em_rt';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** 7 days, matching the backend's default JWT_REFRESH_TTL. */
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export async function setRefreshCookie(token: string) {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, token, refreshCookieOptions(REFRESH_MAX_AGE));
}

export async function clearRefreshCookie() {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, '', refreshCookieOptions(0));
}

export async function readRefreshCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}

/** Call the Express API from the server. */
export async function callBackend(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  const h = new Headers(headers);
  if (accessToken) h.set('authorization', `Bearer ${accessToken}`);
  return fetch(`${BACKEND_URL}/api${path}`, { ...rest, headers: h, cache: 'no-store' });
}
