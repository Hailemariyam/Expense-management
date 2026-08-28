import { NextResponse } from 'next/server';
import {
  callBackend,
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from '@/lib/bff';

/**
 * POST /bff/auth/refresh
 * Reads the httpOnly refresh cookie, rotates it against the backend, sets the
 * new cookie, and returns a fresh { user, accessToken }.
 *
 * Called on app load (silent sign-in) and by the API client after a 401.
 */
export async function POST() {
  const rt = await readRefreshCookie();
  if (!rt) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No session' } },
      { status: 401 },
    );
  }

  const upstream = await callBackend('/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  const json = await upstream.json();

  if (!upstream.ok) {
    await clearRefreshCookie();
    return NextResponse.json(json, { status: upstream.status });
  }

  const { user, accessToken, refreshToken } = json.data;
  await setRefreshCookie(refreshToken);
  return NextResponse.json({ data: { user, accessToken } });
}
