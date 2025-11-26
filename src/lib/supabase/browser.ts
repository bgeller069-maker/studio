'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAnonEnv } from './config';

let browserClient: SupabaseClient | null = null;

/**
 * Returns a memoized browser-safe Supabase client.
 * We only create the client once per bundle to avoid duplicate
 * subscriptions in React client components.
 */
export const getSupabaseBrowserClient = (): SupabaseClient => {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseAnonEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
};

