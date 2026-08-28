'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { CategoryPoint } from '@/lib/types';
import { money } from '@/lib/utils';

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

export function CategoryDonut({ data }: { data: CategoryPoint[] }) {
  const total = data.reduce((s, d) => s + Number(d.total), 0);
  const rows = data
    .map((d, i) => ({
      name: d.category,
      value: Number(d.total),
      count: d.count,
      color: PALETTE[i % PALETTE.length]!,
      pct: total ? Math.round((Number(d.total) / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted">No expense data yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6 min-[420px]:flex-row min-[420px]:gap-6 lg:flex-col lg:gap-6 xl:flex-row xl:gap-8">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={0}
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-muted">Total</span>
          <span className="text-base font-semibold text-foreground">{money(total)}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="truncate text-foreground">{r.name}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">
              {money(r.value)} <span className="text-xs">({r.pct}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
