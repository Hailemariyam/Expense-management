import { NextResponse } from 'next/server';
import { callBackend, setRefreshCookie } from '@/lib/bff';

/**
 * POST /bff/auth/register
 * Body: { name, email, password, companyName? | companyId? }
 * Same token handling as login.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await callBackend('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const json = await upstream.json();
  if (!upstream.ok) return NextResponse.json(json, { status: upstream.status });

  const { user, accessToken, refreshToken } = json.data;
  await setRefreshCookie(refreshToken);
  return NextResponse.json({ data: { user, accessToken } }, { status: 201 });
}
