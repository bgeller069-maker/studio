import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAnonEnv } from './config';

/**
 * Creates a Supabase client bound to the current request's cookies,
 * enabling authenticated server components and server actions.
 */
export const getSupabaseServerClient = async (): Promise<SupabaseClient> => {
  const { url, anonKey } = getSupabaseAnonEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.delete({ name, ...options });
      },
    },
  });
};

