'use client';

import { Loader2 } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-bg/50 p-4 text-sm text-danger">
      {message}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}
