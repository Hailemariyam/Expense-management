export type Role = 'employee' | 'manager' | 'admin';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

export interface Expense {
  id: string;
  companyId: string;
  userId: string;
  amount: string; // decimal string
  category: string;
  expenseDate: string; // YYYY-MM-DD
  comment: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface DashboardBucket {
  count: number;
  total: string;
}
export interface AnalyticsDashboard {
  monthTotal: string;
  monthCount: number;
  pending: DashboardBucket;
  approved: DashboardBucket;
  rejected: DashboardBucket;
}
export interface MonthlyPoint {
  month: string;
  total: string;
  count: number;
}
export interface CategoryPoint {
  category: string;
  total: string;
  count: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
