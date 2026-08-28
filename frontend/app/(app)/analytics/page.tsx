'use client';

import { useState } from 'react';
import { useByCategory, useDashboard, useMonthly } from '@/lib/query';
import { money } from '@/lib/utils';
import { PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { MonthlyChart } from '@/components/charts/MonthlyChart';
import { ErrorState } from '@/components/ui/misc';

export default function AnalyticsPage() {
  const [months, setMonths] = useState(6);
  const dashboard = useDashboard();
  const monthly = useMonthly(months);
  const byCategory = useByCategory();

  const approved = Number(dashboard.data?.approved.total ?? 0);
  const pending = Number(dashboard.data?.pending.total ?? 0);
  const rejected = Number(dashboard.data?.rejected.total ?? 0);
  const totalAll = approved + pending + rejected;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Company-wide expense insights"
        action={
          <div className="w-40">
            <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="This month"
          value={money(dashboard.data?.monthTotal ?? '0')}
          sub={`${dashboard.data?.monthCount ?? 0} expenses`}
          accent="primary"
          loading={dashboard.isLoading}
        />
        <StatCard
          label="Total approved"
          value={money(approved)}
          sub={`${dashboard.data?.approved.count ?? 0} expenses`}
          accent="success"
          loading={dashboard.isLoading}
        />
        <StatCard
          label="Total pending"
          value={money(pending)}
          sub={`${dashboard.data?.pending.count ?? 0} awaiting`}
          accent="warning"
          loading={dashboard.isLoading}
        />
        <StatCard
          label="All-time volume"
          value={money(totalAll)}
          sub="approved + pending + rejected"
          loading={dashboard.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Expense trend</CardTitle>
            <span className="text-xs text-muted">Last {months} months</span>
          </CardHeader>
          <CardBody>
            {monthly.isError ? (
              <ErrorState message={(monthly.error as Error).message} />
            ) : (
              <MonthlyChart data={monthly.data ?? []} variant="area" height={280} />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By category</CardTitle>
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
          <CardTitle>Category breakdown</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {(byCategory.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No data yet.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="py-2.5 pr-3">Category</th>
                    <th className="py-2.5 pr-3 text-right">Count</th>
                    <th className="py-2.5 pr-3 text-right">Total</th>
                    <th className="py-2.5 pr-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...(byCategory.data ?? [])]
                    .sort((a, b) => Number(b.total) - Number(a.total))
                    .map((c) => {
                      const sum = (byCategory.data ?? []).reduce((s, x) => s + Number(x.total), 0);
                      const share = sum ? Math.round((Number(c.total) / sum) * 100) : 0;
                      return (
                        <tr key={c.category}>
                          <td className="py-3 pr-3 font-medium text-foreground">{c.category}</td>
                          <td className="py-3 pr-3 text-right tabular-nums text-muted">{c.count}</td>
                          <td className="py-3 pr-3 text-right font-medium tabular-nums text-foreground">
                            {money(c.total)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-muted">{share}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
