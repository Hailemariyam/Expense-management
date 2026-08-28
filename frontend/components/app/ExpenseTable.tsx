'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, FileText, Paperclip, Send, Trash2, X } from 'lucide-react';
import type { Expense } from '@/lib/types';
import { formatDate, money } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  useDeleteExpense,
  useSetExpenseStatus,
  useSubmitExpense,
} from '@/lib/query';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';

interface Props {
  rows: Expense[];
  loading?: boolean;
  /** Show an "Employee" column (team views). */
  showOwner?: boolean;
  /** Map of userId -> name, for the owner column. */
  ownerNames?: Record<string, string>;
  /** Allow approve/reject actions (manager/admin on pending rows). */
  canModerate?: boolean;
  emptyHint?: string;
}

export function ExpenseTable({
  rows,
  loading,
  showOwner = false,
  ownerNames = {},
  canModerate = false,
  emptyHint = 'No expenses match your filters.',
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const setStatus = useSetExpenseStatus();
  const submit = useSubmitExpense();
  const del = useDeleteExpense();
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  if (loading) {
    return (
      <div className="space-y-2 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted">{emptyHint}</p>;
  }

  const moderate = (id: string, status: 'approved' | 'rejected') => {
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.push('success', `Expense ${status}`),
        onError: (e) => toast.push('error', (e as Error).message),
      },
    );
  };

  return (
    <>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
              {showOwner && <th className="py-2.5 pr-3">Employee</th>}
              <th className="py-2.5 pr-3">Category</th>
              <th className="py-2.5 pr-3">Description</th>
              <th className="py-2.5 pr-3 text-right">Amount</th>
              <th className="py-2.5 pr-3">Date</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-3">Receipt</th>
              <th className="py-2.5 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => {
              const isOwner = e.userId === user?.id;
              const canSubmit = isOwner && e.status === 'rejected';
              const canDelete =
                (isOwner && e.status !== 'approved') || user?.role === 'admin';
              const canModerateRow =
                canModerate && e.status === 'pending' && !(user?.role === 'manager' && isOwner);

              return (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  {showOwner && (
                    <td className="py-3 pr-3 font-medium text-foreground">
                      {ownerNames[e.userId] ?? '—'}
                    </td>
                  )}
                  <td className="py-3 pr-3 text-foreground">{e.category}</td>
                  <td className="max-w-[220px] truncate py-3 pr-3 text-muted">
                    <Link href={`/expenses/${e.id}`} className="hover:text-primary hover:underline">
                      {e.comment || <span className="italic">No description</span>}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-right font-medium tabular-nums text-foreground">
                    {money(e.amount)}
                  </td>
                  <td className="py-3 pr-3 text-muted">{formatDate(e.expenseDate)}</td>
                  <td className="py-3 pr-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="py-3 pr-3">
                    {e.receiptUrl ? (
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="size-3.5" />
                        View
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <FileText className="size-3.5" />
                        None
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {canModerateRow && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            className="!h-8 !w-8 !p-0"
                            title="Approve"
                            loading={setStatus.isPending && setStatus.variables?.id === e.id}
                            onClick={() => moderate(e.id, 'approved')}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="!h-8 !w-8 !p-0"
                            title="Reject"
                            onClick={() => moderate(e.id, 'rejected')}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      )}
                      {canSubmit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!h-8"
                          loading={submit.isPending && submit.variables === e.id}
                          onClick={() =>
                            submit.mutate(e.id, {
                              onSuccess: () => toast.push('success', 'Resubmitted for approval'),
                              onError: (err) => toast.push('error', (err as Error).message),
                            })
                          }
                        >
                          <Send className="size-3.5" />
                          Resubmit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!h-8 !w-8 !p-0 text-muted hover:text-danger"
                          title="Delete"
                          onClick={() => setConfirmDelete(e)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete expense?"
        message={
          confirmDelete
            ? `"${confirmDelete.comment || confirmDelete.category}" for ${money(confirmDelete.amount)} will be permanently removed.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          del.mutate(confirmDelete.id, {
            onSuccess: () => {
              toast.push('success', 'Expense deleted');
              setConfirmDelete(null);
            },
            onError: (e) => toast.push('error', (e as Error).message),
          });
        }}
      />
    </>
  );
}
