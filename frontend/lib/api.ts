'use client';

/**
 * Browser API client. Talks only to the Next.js BFF (`/bff/*`), never the
 * Express backend directly.
 *
 * - Attaches the in-memory access token as a Bearer header.
 * - On a 401 it makes ONE attempt to POST /bff/auth/refresh (which rotates the
 *   httpOnly cookie), updates the token via the registered setter, and retries.
 * - Surfaces backend errors as `ApiClientError` carrying { code, message }.
 */
import type { ApiError } from './types';

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, err: ApiError) {
    super(err.message);
    this.name = 'ApiClientError';
    this.code = err.code;
    this.status = status;
    this.details = err.details;
  }
}

type TokenGetter = () => string | null;
type TokenSetter = (token: string | null) => void;

let getToken: TokenGetter = () => null;
let setToken: TokenSetter = () => {};
let onAuthLost: () => void = () => {};

export function configureApi(opts: {
  getToken: TokenGetter;
  setToken: TokenSetter;
  onAuthLost: () => void;
}) {
  getToken = opts.getToken;
  setToken = opts.setToken;
  onAuthLost = opts.onAuthLost;
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/bff/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const json = await res.json();
      const token: string = json.data.accessToken;
      setToken(token);
      return token;
    } catch {
      return null;
    } finally {
      // allow the next refresh after this batch settles
      setTimeout(() => (refreshInFlight = null), 0);
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body — mutually exclusive with `form`. */
  body?: unknown;
  /** FormData for multipart (receipt upload). */
  form?: FormData;
  query?: Record<string, string | number | undefined | null>;
  /** Skip the auto-refresh-on-401 (used by the refresh call itself). */
  noRetry?: boolean;
  /** Return the full `{ data, meta }` envelope instead of just `data`. */
  envelope?: boolean;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, query, noRetry, envelope } = opts;

  const url = new URL(`/bff${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (form) {
      payload = form; // browser sets multipart boundary
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    return fetch(url.toString(), { method, headers, body: payload });
  };

  let res = await doFetch();

  if (res.status === 401 && !noRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      onAuthLost();
      throw new ApiClientError(401, { code: 'UNAUTHENTICATED', message: 'Session expired' });
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err: ApiError = json.error ?? { code: 'UNKNOWN', message: `HTTP ${res.status}` };
    throw new ApiClientError(res.status, err);
  }
  if (envelope) return json as T;
  return (json.data ?? json) as T;
}
