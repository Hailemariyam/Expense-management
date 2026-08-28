'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/app/Sidebar';
import { Topbar } from '@/components/app/Topbar';
import { PageLoader } from '@/components/ui/misc';

/** Route access by role — keep in sync with Sidebar's NAV. */
const ROLE_GATES: { prefix: string; roles: ('manager' | 'admin')[] }[] = [
  { prefix: '/team-expenses', roles: ['manager', 'admin'] },
  { prefix: '/analytics', roles: ['manager', 'admin'] },
  { prefix: '/users', roles: ['admin'] },
  { prefix: '/company', roles: ['admin'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  // Client-side role gate (backend enforces the real check).
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const gate = ROLE_GATES.find((g) => pathname.startsWith(g.prefix));
    if (gate && !hasRole(...gate.roles)) router.replace('/dashboard');
  }, [status, user, pathname, hasRole, router]);

  if (status !== 'authenticated') return <PageLoader />;

  return (
    <div className="flex min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
