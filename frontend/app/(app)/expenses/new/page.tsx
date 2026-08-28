'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCreateExpense } from '@/lib/query';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ExpenseForm } from '@/components/app/ExpenseForm';

export default function NewExpensePage() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateExpense();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to expenses
      </Link>

      <PageHeader title="Create Expense" subtitle="Submitted expenses start as pending approval." />

      <Card>
        <CardBody>
          <ExpenseForm
            submitLabel="Submit expense"
            submitting={create.isPending}
            onSubmit={(values, receipt) => {
              const fd = new FormData();
              fd.set('amount', values.amount);
              fd.set('category', values.category);
              fd.set('expenseDate', values.expenseDate);
              if (values.comment) fd.set('comment', values.comment);
              if (receipt) fd.set('receipt', receipt);

              create.mutate(fd, {
                onSuccess: () => {
                  toast.push('success', 'Expense submitted for approval');
                  router.push('/expenses');
                },
                onError: (e) => toast.push('error', (e as Error).message),
              });
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
