'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageLoader } from '@/components/ui/misc';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') return <PageLoader />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Wallet className="size-4" />
          </span>
          Expense Management
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Track, submit and approve
            <br />
            expenses in one place.
          </h1>
          <p className="max-w-sm text-sm text-sidebar-fg">
            Company-scoped by design — every expense, user and report stays inside your
            organization. Roles for employees, managers and admins.
          </p>
        </div>
        <p className="text-xs text-sidebar-fg/70">
          &copy; {new Date().getFullYear()} Expense Management
        </p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-12 size-72 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
