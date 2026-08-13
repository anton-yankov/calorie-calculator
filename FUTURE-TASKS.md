# Future tasks

Things deliberately deferred — pick one up by asking Claude for it by name.
The first two are manual dashboard/SQL steps only you can run.

## Create the settings table (required for daily goals)

The goals feature reads/writes a single-row `public.settings` table. Run the
`create table public.settings ...` block at the bottom of
`supabase/schema.sql` in the Supabase SQL Editor. Until then the app treats
goals as "not set" and everything else keeps working.

## Finish the secret-key switch: drop the anon RLS policies

The code now prefers `SUPABASE_SECRET_KEY` (set in `.env.local`; add it to
Vercel too) and falls back to the publishable key. Once a deploy with the
secret key is live on Vercel, cut off the old path — run in the SQL Editor:

```sql
drop policy "anon can read meals" on public.meals;
drop policy "anon can insert meals" on public.meals;
drop policy "anon can delete meals" on public.meals;
revoke select, insert, delete on public.meals from anon;
```

Running this **before** that deploy is live would break the site's database
access, since the fallback publishable key maps to the `anon` role.

## Add the Supabase env vars to Vercel

Before the next deploy, make sure `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` (values from
`.env.local`) are in the Vercel project's environment variables — the deployed
site has no `.env.local`.

## Paginate the meal log

`listMeals()` fetches every row including thumbnails (~10 KB each). Fine for
months of personal use, but at thousands of entries the page payload gets
heavy — add pagination or lazy day-by-day loading when that day comes.

## Add a screenshot to the README

The README describes the flow; a screenshot of the Analyze page with an
estimate would show it faster. Take one on a phone, drop it in `docs/`, and
link it from the README intro.
