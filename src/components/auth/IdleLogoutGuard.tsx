'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { signOutAction } from '@/app/actions';

type IdleLogoutGuardProps = {
  children: React.ReactNode;
};

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export default function IdleLogoutGuard({ children }: IdleLogoutGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleIdle = useCallback(async () => {
    // Avoid re-triggering on routes that are already public/auth-related.
    if (pathname === '/login' || pathname.startsWith('/auth')) {
      return;
    }

    try {
      await signOutAction();
    } catch {
      // Fallback: if server action redirect fails for any reason, force client navigation.
      router.push('/login');
    }
  }, [pathname, router]);

  useIdleLogout({
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: handleIdle,
  });

  return <>{children}</>;
}

