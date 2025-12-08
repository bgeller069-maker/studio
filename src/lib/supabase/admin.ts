import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServiceEnv } from './config';

/**
 * Returns a service-role Supabase client for one-off scripts or
 * background jobs. Do **not** use this in the browser.
 */
export const getSupabaseAdminClient = (): SupabaseClient => {
  const { url, serviceRoleKey } = getSupabaseServiceEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};



