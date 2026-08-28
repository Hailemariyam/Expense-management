'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  push: (kind: ToastKind, message: string) => void;
} | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg',
              t.kind === 'success' && 'border-success/30',
              t.kind === 'error' && 'border-danger/30',
              t.kind === 'info' && 'border-border',
            )}
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
            {t.kind === 'error' && <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
            {t.kind === 'info' && <Info className="mt-0.5 size-4 shrink-0 text-muted" />}
            <span className="text-foreground">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
