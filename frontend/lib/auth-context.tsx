'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, configureApi } from './api';
import type { Role, User } from './types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  companyId?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading' });

  const setToken = useCallback((t: string | null) => {
    tokenRef.current = t;
  }, []);

  const onAuthLost = useCallback(() => {
    tokenRef.current = null;
    setState({ user: null, status: 'anonymous' });
    router.replace('/login');
  }, [router]);

  // Wire the plain api client to this provider's token + callbacks.
  useEffect(() => {
    configureApi({
      getToken: () => tokenRef.current,
      setToken,
      onAuthLost,
    });
  }, [setToken, onAuthLost]);

  // Silent sign-in on first load: try to mint an access token from the
  // httpOnly refresh cookie, then load the profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/bff/auth/refresh', { method: 'POST' });
        if (!res.ok) throw new Error('no session');
        const json = await res.json();
        if (cancelled) return;
        tokenRef.current = json.data.accessToken;
        setState({ user: json.data.user, status: 'authenticated' });
      } catch {
        if (!cancelled) setState({ user: null, status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/bff/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? 'Login failed');
    tokenRef.current = json.data.accessToken;
    setState({ user: json.data.user, status: 'authenticated' });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await fetch('/bff/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? 'Registration failed');
    tokenRef.current = json.data.accessToken;
    setState({ user: json.data.user, status: 'authenticated' });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', noRetry: true });
    } catch {
      /* ignore */
    }
    tokenRef.current = null;
    setState({ user: null, status: 'anonymous' });
    router.replace('/login');
  }, [router]);

  const hasRole = useCallback(
    (...roles: Role[]) => (state.user ? roles.includes(state.user.role) : false),
    [state.user],
  );

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
