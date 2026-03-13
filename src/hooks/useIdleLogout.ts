'use client';

import { useEffect, useRef } from 'react';

type UseIdleLogoutOptions = {
  timeoutMs: number;
  onIdle: () => void;
};

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

export function useIdleLogout({ timeoutMs, onIdle }: UseIdleLogoutOptions) {
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedOutRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const resetTimer = () => {
      if (hasLoggedOutRef.current) return;

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      timeoutIdRef.current = setTimeout(() => {
        if (hasLoggedOutRef.current) return;
        hasLoggedOutRef.current = true;
        onIdle();
      }, timeoutMs);
    };

    resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [onIdle, timeoutMs]);
}

