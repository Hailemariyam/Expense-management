import { cn } from '@/lib/utils';
import type { ExpenseStatus, Role } from '@/lib/types';

const statusStyles: Record<ExpenseStatus, string> = {
  pending: 'bg-warning-bg text-warning',
  approved: 'bg-success-bg text-success',
  rejected: 'bg-danger-bg text-danger',
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}

const roleStyles: Record<Role, string> = {
  admin: 'bg-primary-100 text-primary-700',
  manager: 'bg-sky-100 text-sky-700',
  employee: 'bg-slate-100 text-slate-600',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        roleStyles[role],
      )}
    >
      {role}
    </span>
  );
}
