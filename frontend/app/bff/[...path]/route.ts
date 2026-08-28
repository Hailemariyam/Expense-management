/**
 * Transparent proxy: /bff/<anything>  ->  <BACKEND_URL>/api/<anything>
 *
 * The client calls this with an `Authorization: Bearer <accessToken>` header
 * (added by lib/api.ts from the in-memory token). Auth endpoints under
 * /bff/auth/* are handled by dedicated route handlers, not this proxy.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/bff';

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, path: string[]) {
  const suffix = path.join('/');
  const url = `${BACKEND_URL}/api/${suffix}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const upstream = await fetch(url, {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const resHeaders = new Headers(upstream.headers);
  resHeaders.delete('content-encoding');
  resHeaders.delete('content-length');
  resHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
