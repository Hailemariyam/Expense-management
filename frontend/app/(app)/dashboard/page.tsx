'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useByCategory, useDashboard, useExpenses, useMonthly } from '@/lib/query';
import { money } from '@/lib/utils';
import { PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { MonthlyChart } from '@/components/charts/MonthlyChart';
import { ErrorState } from '@/components/ui/misc';
import { ExpenseTable } from '@/components/app/ExpenseTable';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isPrivileged = hasRole('manager', 'admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${user?.name?.split(' ')[0] ?? 'there'} 👋`}
        subtitle="Here's your expense overview"
        action={
          <Link href="/expenses/new">
            <Button size="md">
              <Plus className="size-4" />
              New expense
            </Button>
          </Link>
        }
      />
      {isPrivileged ? <PrivilegedDashboard /> : <EmployeeDashboard />}
    </div>
  );
}

/** Manager / admin: company-wide analytics (backend analytics endpoints). */
function PrivilegedDashboard() {
  const { user } = useAuth();
  const dashboard = useDashboard();
  const monthly = useMonthly(6);
  const byCategory = useByCategory();
  const recent = useExpenses({ scope: 'me', page: 1, pageSize: 5 });

  return (
    <>
      {dashboard.isError ? (
        <ErrorState message={(dashboard.error as Error).message} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="This month"
            value={money(dashboard.data?.monthTotal ?? '0')}
            sub={`${dashboard.data?.monthCount ?? 0} expenses`}
            accent="primary"
            loading={dashboard.isLoading}
          />
          <StatCard
            label="Pending"
            value={money(dashboard.data?.pending.total ?? '0')}
            sub={`${dashboard.data?.pending.count ?? 0} awaiting approval`}
            accent="warning"
            loading={dashboard.isLoading}
          />
          <StatCard
            label="Approved"
            value={money(dashboard.data?.approved.total ?? '0')}
            sub={`${dashboard.data?.approved.count ?? 0} expenses`}
            accent="success"
            loading={dashboard.isLoading}
          />
          <StatCard
            label="Rejected"
            value={money(dashboard.data?.rejected.total ?? '0')}
            sub={`${dashboard.data?.rejected.count ?? 0} expenses`}
            accent="danger"
            loading={dashboard.isLoading}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Monthly expenses</CardTitle>
            <span className="text-xs text-muted">Last 6 months</span>
          </CardHeader>
          <CardBody>
            {monthly.isError ? (
              <ErrorState message={(monthly.error as Error).message} />
            ) : (
              <MonthlyChart data={monthly.data ?? []} variant="bar" />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardBody>
            {byCategory.isError ? (
              <ErrorState message={(byCategory.error as Error).message} />
            ) : (
              <CategoryDonut data={byCategory.data ?? []} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My recent expenses</CardTitle>
          <Link href="/expenses" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          <ExpenseTable
            rows={recent.data?.data ?? []}
            loading={recent.isLoading}
            emptyHint="Create your first expense to see it here."
          />
        </CardBody>
      </Card>

      <p className="text-xs text-muted">
        Tip: as a {user?.role}, use <span className="font-medium">Team Expenses</span> to review and
        approve your team&apos;s submissions.
      </p>
    </>
  );
}

/** Employee: personal overview, computed from their own expenses (no analytics API). */
function EmployeeDashboard() {
  const all = useExpenses({ scope: 'me', page: 1, pageSize: 100 });
  const recent = useExpenses({ scope: 'me', page: 1, pageSize: 5 });

  const stats = useMemo(() => {
    const rows = all.data?.data ?? [];
    const sum = (s: string) =>
      rows.filter((e) => e.status === s).reduce((acc, e) => acc + Number(e.amount), 0);
    const count = (s: string) => rows.filter((e) => e.status === s).length;
    const now = new Date();
    const thisMonth = rows
      .filter((e) => {
        const d = new Date(e.expenseDate);
        return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      })
      .reduce((acc, e) => acc + Number(e.amount), 0);
    return {
      thisMonth,
      pending: sum('pending'),
      pendingCount: count('pending'),
      approved: sum('approved'),
      approvedCount: count('approved'),
      rejected: sum('rejected'),
      rejectedCount: count('rejected'),
    };
  }, [all.data]);

  return (
    <>
      {all.isError ? (
        <ErrorState message={(all.error as Error).message} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="This month"
            value={money(stats.thisMonth)}
            accent="primary"
            loading={all.isLoading}
          />
          <StatCard
            label="Pending"
            value={money(stats.pending)}
            sub={`${stats.pendingCount} awaiting approval`}
            accent="warning"
            loading={all.isLoading}
          />
          <StatCard
            label="Approved"
            value={money(stats.approved)}
            sub={`${stats.approvedCount} expenses`}
            accent="success"
            loading={all.isLoading}
          />
          <StatCard
            label="Rejected"
            value={money(stats.rejected)}
            sub={`${stats.rejectedCount} expenses`}
            accent="danger"
            loading={all.isLoading}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
          <Link href="/expenses" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          <ExpenseTable
            rows={recent.data?.data ?? []}
            loading={recent.isLoading}
            emptyHint="Create your first expense to see it here."
          />
        </CardBody>
      </Card>
    </>
  );
}
