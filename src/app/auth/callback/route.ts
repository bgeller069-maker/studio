import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseAnonEnv } from '@/lib/supabase/config';
import { cookies } from 'next/headers';

/**
 * Auth callback for Supabase.
 * Handles OAuth and magic link redirects by exchanging the code for a session
 * and storing it in cookies. Email/password sign-in sets the session in the
 * client; this route is for flows that redirect back with a code.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const { url, anonKey } = getSupabaseAnonEnv();
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anonKey, {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback', request.url));
}
