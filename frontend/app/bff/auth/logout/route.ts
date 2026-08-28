import { NextResponse } from 'next/server';
import { callBackend, clearRefreshCookie, readRefreshCookie } from '@/lib/bff';

/**
 * POST /bff/auth/logout
 * Revokes the refresh token on the backend (best-effort) and clears the cookie.
 * Requires the caller's access token (Authorization header) for the backend's
 * authenticated /auth/logout.
 */
export async function POST(req: Request) {
  const rt = await readRefreshCookie();
  const accessToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (rt && accessToken) {
    await callBackend('/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      accessToken,
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => undefined);
  }

  await clearRefreshCookie();
  return NextResponse.json({ data: { success: true } });
}
