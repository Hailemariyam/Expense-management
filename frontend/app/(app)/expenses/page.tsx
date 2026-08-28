'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ExpenseStatus } from '@/lib/types';
import { useExpenses } from '@/lib/query';
import { CATEGORY_SUGGESTIONS } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { ExpenseTable } from '@/components/app/ExpenseTable';
import { Pagination } from '@/components/app/Pagination';

const TABS: { key: ExpenseStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function MyExpensesPage() {
  const [tab, setTab] = useState<ExpenseStatus | 'all'>('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, error } = useExpenses({
    scope: 'me',
    status: tab === 'all' ? undefined : tab,
    category: category || undefined,
    page,
    pageSize,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Expenses"
        subtitle="Everything you've submitted"
        action={
          <Link href="/expenses/new">
            <Button>
              <Plus className="size-4" />
              Create Expense
            </Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-border bg-slate-50 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === t.key
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isError ? (
            <p className="py-8 text-center text-sm text-danger">{(error as Error).message}</p>
          ) : (
            <>
              <ExpenseTable
                rows={data?.data ?? []}
                loading={isLoading}
                emptyHint="No expenses here yet. Create one to get started."
              />
              {data && (
                <Pagination
                  page={data.meta.page}
                  pageSize={data.meta.pageSize}
                  total={data.meta.total}
                  onPage={setPage}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
