import { NextResponse } from 'next/server';
import { callBackend, setRefreshCookie } from '@/lib/bff';

/**
 * POST /bff/auth/login
 * Body: { email, password }
 * On success: stores the refresh token in an httpOnly cookie and returns
 * { user, accessToken } to the client (access token held in memory).
 */
export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await callBackend('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const json = await upstream.json();
  if (!upstream.ok) return NextResponse.json(json, { status: upstream.status });

  const { user, accessToken, refreshToken } = json.data;
  await setRefreshCookie(refreshToken);
  return NextResponse.json({ data: { user, accessToken } });
}
