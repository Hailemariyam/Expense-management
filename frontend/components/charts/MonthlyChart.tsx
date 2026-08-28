'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyPoint } from '@/lib/types';
import { formatMonth, money } from '@/lib/utils';

interface Props {
  data: MonthlyPoint[];
  variant?: 'area' | 'bar';
  height?: number;
}

const axis = { fontSize: 11, fill: '#9ca3af' };

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted">{money(payload[0].value)}</p>
    </div>
  );
}

export function MonthlyChart({ data, variant = 'area', height = 240 }: Props) {
  const rows = data.map((d) => ({ month: formatMonth(d.month), total: Number(d.total) }));

  if (!rows.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted">
        No monthly data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === 'bar' ? (
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => `$${v / 1000}k`} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f3f4f6' }} />
          <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      ) : (
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
          <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => `$${v / 1000}k`} />
          <Tooltip content={<TooltipBox />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#fillTotal)"
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
