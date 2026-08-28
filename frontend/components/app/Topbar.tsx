'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCompany } from '@/lib/query';
import { Avatar } from '@/components/ui/misc';
import { RoleBadge } from '@/components/ui/Badge';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { data: company } = useCompany();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenu}
        className="rounded-md p-1.5 text-muted hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {company?.name ?? ' '}
        </p>
        <p className="text-xs text-muted">Expense workspace</p>
      </div>

      <div className="ml-auto" ref={ref}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
        >
          <Avatar name={user?.name ?? '?'} />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight text-foreground">
              {user?.name}
            </span>
            <span className="block text-xs leading-tight text-muted">{user?.email}</span>
          </span>
          <ChevronDown className="size-4 text-muted" />
        </button>

        {menuOpen && (
          <div className="absolute right-4 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
              <div className="mt-1.5">{user && <RoleBadge role={user.role} />}</div>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
