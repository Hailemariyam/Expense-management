import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "$1,234.50" from a decimal string like "1234.5". */
export function money(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** "Aug 28, 2025" from "2025-08-28". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "2025-08" -> "Aug 2025" */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
