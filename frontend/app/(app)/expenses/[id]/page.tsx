'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Paperclip, Pencil, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  useDeleteExpense,
  useExpense,
  useSetExpenseStatus,
  useSubmitExpense,
  useUpdateExpense,
} from '@/lib/query';
import { formatDate, money } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { ExpenseForm } from '@/components/app/ExpenseForm';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const { data: expense, isLoading, isError, error } = useExpense(id);
  const update = useUpdateExpense(id);
  const submit = useSubmitExpense();
  const setStatus = useSetExpenseStatus();
  const del = useDeleteExpense();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!expense) return null;

  const isOwner = expense.userId === user?.id;
  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'manager' || isAdmin;
  const canEdit = isOwner && expense.status === 'pending';
  const canResubmit = isOwner && expense.status === 'rejected';
  const canModerate =
    isModerator && expense.status === 'pending' && !(user?.role === 'manager' && isOwner);
  const canDelete = (isOwner && expense.status !== 'approved') || isAdmin;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <PageHeader
        title={expense.comment || expense.category}
        subtitle={`Submitted ${formatDate(expense.createdAt)}`}
        action={<StatusBadge status={expense.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          {canEdit && !editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardBody>
          {editing ? (
            <ExpenseForm
              withReceipt={false}
              submitLabel="Save changes"
              submitting={update.isPending}
              defaultValues={{
                amount: expense.amount,
                category: expense.category,
                expenseDate: expense.expenseDate,
                comment: expense.comment ?? '',
              }}
              onSubmit={(values) =>
                update.mutate(
                  {
                    amount: values.amount,
                    category: values.category,
                    expenseDate: values.expenseDate,
                    comment: values.comment ?? '',
                  },
                  {
                    onSuccess: () => {
                      toast.push('success', 'Expense updated');
                      setEditing(false);
                    },
                    onError: (e) => toast.push('error', (e as Error).message),
                  },
                )
              }
            />
          ) : (
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Amount" value={money(expense.amount)} />
              <Field label="Category" value={expense.category} />
              <Field label="Date" value={formatDate(expense.expenseDate)} />
              <Field label="Status" value={<StatusBadge status={expense.status} />} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Description
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {expense.comment || <span className="italic text-muted">No description</span>}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Receipt</dt>
                <dd className="mt-1 text-sm">
                  {expense.receiptUrl ? (
                    <a
                      href={expense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Paperclip className="size-4" />
                      View receipt
                    </a>
                  ) : (
                    <span className="italic text-muted">No receipt attached</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </CardBody>
      </Card>

      {!editing && (canResubmit || canModerate || canDelete) && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-2">
            {canModerate && (
              <>
                <Button
                  variant="success"
                  loading={setStatus.isPending && setStatus.variables?.status === 'approved'}
                  onClick={() =>
                    setStatus.mutate(
                      { id, status: 'approved' },
                      {
                        onSuccess: () => toast.push('success', 'Expense approved'),
                        onError: (e) => toast.push('error', (e as Error).message),
                      },
                    )
                  }
                >
                  <Check className="size-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  loading={setStatus.isPending && setStatus.variables?.status === 'rejected'}
                  onClick={() =>
                    setStatus.mutate(
                      { id, status: 'rejected' },
                      {
                        onSuccess: () => toast.push('success', 'Expense rejected'),
                        onError: (e) => toast.push('error', (e as Error).message),
                      },
                    )
                  }
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </>
            )}
            {canResubmit && (
              <Button
                variant="secondary"
                loading={submit.isPending}
                onClick={() =>
                  submit.mutate(id, {
                    onSuccess: () => toast.push('success', 'Resubmitted for approval'),
                    onError: (e) => toast.push('error', (e as Error).message),
                  })
                }
              >
                <Send className="size-4" />
                Resubmit for approval
              </Button>
            )}
            <div className="ml-auto" />
            {canDelete && (
              <Button
                variant="ghost"
                className="text-danger hover:bg-danger-bg"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete expense?"
        message="This permanently removes the expense and its receipt."
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          del.mutate(id, {
            onSuccess: () => {
              toast.push('success', 'Expense deleted');
              router.push('/expenses');
            },
            onError: (e) => toast.push('error', (e as Error).message),
          })
        }
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
