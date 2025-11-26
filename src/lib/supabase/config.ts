/**
 * Shared helpers for reading Supabase environment variables.
 * Throwing early keeps both server and client code paths honest and
 * makes deployment failures obvious in Vercel logs.
 */

type SupabaseAnonEnv = {
  url: string;
  anonKey: string;
};

type SupabaseServiceEnv = SupabaseAnonEnv & {
  serviceRoleKey: string;
};

const missingEnvError = (vars: string[]) =>
  new Error(
    `Missing Supabase environment variables: ${vars.join(
      ', ',
    )}. Add them to .env.local (for local dev) or the Vercel project settings.`,
  );

/**
 * Reads the public Supabase URL and anon key that are safe to expose to
 * browsers.
 */
export const getSupabaseAnonEnv = (): SupabaseAnonEnv => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing: string[] = [];

  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (missing.length) {
    throw missingEnvError(missing);
  }

  return {
    url: url as string,
    anonKey: anonKey as string,
  };
};

/**
 * Reads the service role key for privileged (server-only) operations.
 */
export const getSupabaseServiceEnv = (): SupabaseServiceEnv => {
  const { url, anonKey } = getSupabaseAnonEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw missingEnvError(['SUPABASE_SERVICE_ROLE_KEY']);
  }

  return { url, anonKey, serviceRoleKey };
};

