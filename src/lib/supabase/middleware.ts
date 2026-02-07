import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** Routes that do not require authentication. All other routes are protected. */
const PUBLIC_PATHS = ['/login', '/auth'];

const getEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );
}

/**
 * Auth guard: refreshes session and redirects unauthenticated users to /login.
 * Only /login and /auth/* are allowed without a session; all other routes require a logged-in user.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const env = getEnv();

  if (!env) {
    // Supabase not configured: still enforce guard — only public paths allowed
    if (isPublicPath(pathname)) {
      return NextResponse.next({ request });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged in: allow access, but redirect away from login page
  if (user) {
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // Not logged in: allow only public paths, otherwise redirect to login
  if (isPublicPath(pathname)) {
    return response;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirectTo', pathname);
  return NextResponse.redirect(loginUrl);
}
