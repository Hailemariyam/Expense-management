'use client';

import { useMemo, useState } from 'react';
import type { ExpenseStatus } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useExpenses, useUsers } from '@/lib/query';
import { CATEGORY_SUGGESTIONS } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { ExpenseTable } from '@/components/app/ExpenseTable';
import { Pagination } from '@/components/app/Pagination';

const TABS: { key: ExpenseStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export default function TeamExpensesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ExpenseStatus | 'all'>('pending');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, error } = useExpenses({
    scope: 'team',
    status: tab === 'all' ? undefined : tab,
    category: category || undefined,
    page,
    pageSize,
  });

  // Admins can resolve names via /users; managers cannot (admin-only endpoint),
  // so they see "You" for their own rows and a short id otherwise.
  const usersQuery = useUsers(
    { page: 1, pageSize: 100 },
    { enabled: user?.role === 'admin' },
  );
  const ownerNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (user) map[user.id] = 'You';
    for (const u of usersQuery.data?.data ?? []) map[u.id] = u.name;
    return map;
  }, [usersQuery.data, user]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Expenses"
        subtitle="Review and approve your team's submissions"
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
                showOwner
                ownerNames={ownerNames}
                canModerate
                emptyHint={
                  tab === 'pending'
                    ? 'Nothing awaiting approval right now. 🎉'
                    : 'No expenses match your filters.'
                }
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
