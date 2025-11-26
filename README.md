# LedgerBalance (Supabase + Vercel)

LedgerBalance is a Next.js 15 starter that now ships with Supabase helpers and
is ready to deploy on Vercel.

## Local development

1. Duplicate `.env.example` as `.env.local` and add your Supabase project keys.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

The core server-side logic still lives in `src/lib/data.ts` for now, and the
Supabase helpers are available under `src/lib/supabase` for when you're ready to
replace the in-memory JSON storage with real tables.

## Deploying to Vercel

1. Push your branch to GitHub/GitLab.
2. Import the repo in Vercel and select the `main` branch (or whichever branch
   you want to deploy).
3. Add the same Supabase environment variables (from `.env.example`) in the
   Vercel Project Settings → Environment Variables.
4. Trigger a deployment; no extra configuration files are required.
