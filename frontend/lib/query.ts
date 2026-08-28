'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type {
  AnalyticsDashboard,
  CategoryPoint,
  Company,
  Expense,
  ExpenseStatus,
  MonthlyPoint,
  Paginated,
  User,
} from './types';

// ---- Query keys ---------------------------------------------------------
export const qk = {
  company: ['company'] as const,
  expenses: (params: Record<string, unknown>) => ['expenses', params] as const,
  expense: (id: string) => ['expense', id] as const,
  users: (params: Record<string, unknown>) => ['users', params] as const,
  analyticsDashboard: ['analytics', 'dashboard'] as const,
  analyticsMonthly: (months: number) => ['analytics', 'monthly', months] as const,
  analyticsByCategory: (range: unknown) => ['analytics', 'by-category', range] as const,
};

// ---- Company ----------------------------------------------------------
export function useCompany() {
  return useQuery({
    queryKey: qk.company,
    queryFn: () => apiFetch<Company>('/companies/me'),
  });
}

export function useRenameCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Company>('/companies/me', { method: 'PATCH', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.company }),
  });
}

// ---- Expenses -------------------------------------------------------------
export interface ExpenseListParams {
  scope?: 'me' | 'team';
  status?: ExpenseStatus;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useExpenses(params: ExpenseListParams) {
  return useQuery({
    queryKey: qk.expenses(params as Record<string, unknown>),
    queryFn: () =>
      apiFetch<Paginated<Expense>>('/expenses', {
        query: params as Record<string, string | number | undefined>,
        envelope: true,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: qk.expense(id),
    queryFn: () => apiFetch<Expense>(`/expenses/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => apiFetch<Expense>('/expenses', { method: 'POST', form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Expense, 'amount' | 'category' | 'expenseDate' | 'comment'>>) =>
      apiFetch<Expense>(`/expenses/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: qk.expense(id) });
    },
  });
}

export function useSubmitExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Expense>(`/expenses/${id}/submit`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useSetExpenseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiFetch<Expense>(`/expenses/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// ---- Users (admin) ---------------------------------------------------------
export function useUsers(
  params: { page?: number; pageSize?: number },
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: qk.users(params),
    queryFn: () =>
      apiFetch<Paginated<User>>('/users', {
        query: params as Record<string, number | undefined>,
        envelope: true,
      }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => apiFetch<User>(`/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; role?: User['role']; password?: string };
    }) => apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ---- Analytics ---------------------------------------------------------
export function useDashboard() {
  return useQuery({
    queryKey: qk.analyticsDashboard,
    queryFn: () => apiFetch<AnalyticsDashboard>('/analytics/dashboard'),
  });
}

export function useMonthly(months = 6) {
  return useQuery({
    queryKey: qk.analyticsMonthly(months),
    queryFn: () => apiFetch<MonthlyPoint[]>('/analytics/monthly', { query: { months } }),
  });
}

export function useByCategory(range?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: qk.analyticsByCategory(range ?? null),
    queryFn: () =>
      apiFetch<CategoryPoint[]>('/analytics/by-category', {
        query: range as Record<string, string | undefined>,
      }),
  });
}
