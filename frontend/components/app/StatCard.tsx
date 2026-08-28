import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/misc';

export function StatCard({
  label,
  value,
  sub,
  accent = 'default',
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
  loading?: boolean;
}) {
  const accentText = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[accent];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums', accentText)}>{value}</p>
      )}
      {sub && !loading && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
