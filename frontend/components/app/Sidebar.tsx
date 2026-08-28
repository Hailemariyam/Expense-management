'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Receipt,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Role[]; // undefined = everyone
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'My Expenses', icon: Wallet },
  { href: '/team-expenses', label: 'Team Expenses', icon: Receipt, roles: ['manager', 'admin'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['manager', 'admin'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['admin'] },
  { href: '/company', label: 'Company', icon: Building2, roles: ['admin'] },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();

  const items = NAV.filter((i) => !i.roles || hasRole(...i.roles));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-fg transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Wallet className="size-4" />
            </span>
            Expense Mgmt
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-fg hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-fg/50">
            Menu
          </p>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'text-sidebar-fg hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 text-xs text-sidebar-fg/60">
          Signed in as <span className="font-medium text-sidebar-fg">{user?.name}</span>
          <br />
          <span className="capitalize">{user?.role}</span>
        </div>
      </aside>
    </>
  );
}
