'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageLoader } from '@/components/ui/misc';

/** Route the visitor to the app or the login screen based on session state. */
export default function IndexPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
    else if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  return <PageLoader />;
}
