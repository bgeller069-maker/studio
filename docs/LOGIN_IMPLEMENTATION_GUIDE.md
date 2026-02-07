# Step-by-Step Guide: Email/Password Login with Supabase

This guide explains how login is implemented in this project and how to configure Supabase for Email/Password auth.

---

## 1. Supabase setup (Dashboard)

1. **Create a project** at [supabase.com](https://supabase.com) if you don’t have one.

2. **Enable Email auth**
   - In the Supabase Dashboard: **Authentication** → **Providers** → **Email**.
   - Ensure **Enable Email provider** is ON.
   - Optionally enable **Confirm email** if you want users to verify their email before signing in.

3. **Get project keys**
   - **Project Settings** → **API**.
   - Copy:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Configure redirect URL (for OAuth / magic links later)**
   - **Authentication** → **URL Configuration**.
   - Add **Redirect URLs**:  
     `http://localhost:9002/auth/callback` (dev) and your production URL, e.g.  
     `https://yourdomain.com/auth/callback`.

5. **Environment variables**
   - Copy `.env.example` to `.env.local`.
   - Set:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Optional (for scripts/admin): `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. What’s implemented in the app

### 2.1 Login page (`/login`)

- **Route:** `src/app/login/page.tsx`
- **Form:** `src/components/auth/LoginForm.tsx`
- **Fields:** Email (required, valid email) and Password (required).
- **Behaviour:** On submit, the app calls `supabase.auth.signInWithPassword({ email, password })`. On success it shows a toast and redirects to `/`. On error it shows the Supabase error in a toast.

### 2.2 Auth callback (`/auth/callback`)

- **Route:** `src/app/auth/callback/route.ts`
- **Purpose:** Used when Supabase redirects back with a `code` (e.g. OAuth or magic link). It exchanges the code for a session and stores it in cookies, then redirects to `/` or `?next=...`.
- **Email/password:** Not used for the basic email/password form; the session is set directly in the browser. This route is for other flows that redirect with a code.

### 2.3 Middleware (session refresh and protection)

- **Files:**  
  - `middleware.ts` (root)  
  - `src/lib/supabase/middleware.ts`
- **Behaviour:**
  - Refreshes the Supabase session on each request (so cookies stay in sync).
  - If the user is **logged in** and visits `/login` → redirect to `/`.
  - If the user is **not logged in** and visits any protected route → redirect to `/login`.
  - Public routes: `/login`, `/auth/*`.

### 2.4 Logout

- **Action:** `signOutAction` in `src/app/actions.ts` (calls `supabase.auth.signOut()`, then redirects to `/login`).
- **UI:** Header includes a “Sign out” button (icon) that calls this action.

### 2.5 Layout and data

- **Root layout** (`src/app/layout.tsx`): Tries to load books for the app. If the user is not logged in (or RLS blocks access), it catches the error and passes an empty list so the login page and other auth flows still render.
- **Bottom nav:** Hidden on `/login` so the login page is full-screen.

---

## 3. Flow summary

1. User opens the app → middleware runs.
2. No session → redirect to `/login`.
3. User enters email and password and submits.
4. `LoginForm` calls `signInWithPassword`; Supabase sets the session (cookies).
5. `router.refresh()` and `router.push('/')` take the user to the dashboard.
6. On later requests, middleware refreshes the session and allows access to protected routes.
7. User clicks “Sign out” in the header → `signOutAction` runs → redirect to `/login`.

---

## 4. Optional: sign up (registration)

To add a **Sign up** page:

1. **Supabase:** In **Authentication** → **Providers** → **Email**, ensure sign-ups are allowed (default).
2. **App:** Add e.g. `src/app/signup/page.tsx` and a form that calls:
   ```ts
   await getSupabaseBrowserClient().auth.signUp({ email, password });
   ```
3. After sign-up, either redirect to `/login` or use the session if Supabase returns one (e.g. with “Confirm email” off).
4. Add a link from the login page to the sign-up page (e.g. “Create an account”).

---

## 5. Optional: password reset

1. **Supabase:** Email provider and SMTP (or Supabase’s built-in emails) must be configured.
2. **App:** Add a “Forgot password?” link on the login page that:
   - Opens a small form or modal to collect email.
   - Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback` })`.
3. User clicks the link in the email → Supabase redirects to `/auth/callback?code=...` → your callback exchanges the code and can redirect to a “Set new password” page or show a form that calls `supabase.auth.updateUser({ password })`.

---

## 6. Row-Level Security (RLS)

Your backend docs describe tables keyed by `user_id` and policies like `auth.uid() = user_id`. Ensure:

- All relevant tables have RLS enabled.
- Select/insert/update/delete policies use `auth.uid()` (e.g. `auth.uid() = user_id` or join through `books.user_id`).
- When the user is logged in, `getSupabaseServerClient()` and the browser client send the session, so Supabase can evaluate `auth.uid()` correctly.

---

## 7. Files touched for login

| Purpose              | File(s) |
|----------------------|--------|
| Login UI             | `src/app/login/page.tsx`, `src/components/auth/LoginForm.tsx` |
| Auth callback        | `src/app/auth/callback/route.ts` |
| Session + redirects  | `middleware.ts`, `src/lib/supabase/middleware.ts` |
| Logout               | `src/app/actions.ts` (`signOutAction`), `src/components/layout/Header.tsx` |
| Layout / nav         | `src/app/layout.tsx` (safe `getBooks`), `src/components/layout/BottomNav.tsx` (hide on `/login`) |

You can use this as a checklist when debugging or extending login, sign-up, or password reset.
