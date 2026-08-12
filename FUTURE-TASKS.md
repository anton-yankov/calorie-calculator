# Future tasks

Things deliberately deferred — pick one up by asking Claude for it by name.

## Switch Supabase access to the secret key

The app currently talks to the database with the **publishable** key, which maps
to the `anon` Postgres role. The RLS policies in `supabase/schema.sql` therefore
allow `anon` full access to `public.meals`. The key never ships to the browser
(all access is server-side, behind the site password gate), but anyone who
obtained the publishable key could read/write the log directly.

To tighten this up:

1. In the Supabase dashboard → Project Settings → API keys, copy the **secret**
   key (`sb_secret_...`).
2. Add it to `.env.local` and to Vercel as `SUPABASE_SECRET_KEY` (server-only —
   no `NEXT_PUBLIC_` prefix).
3. Update `src/lib/supabase.ts` to use `SUPABASE_SECRET_KEY` (the secret key
   bypasses RLS).
4. Run in the SQL Editor:

   ```sql
   drop policy "anon can read meals" on public.meals;
   drop policy "anon can insert meals" on public.meals;
   drop policy "anon can delete meals" on public.meals;
   revoke select, insert, delete on public.meals from anon;
   ```

## Add the Supabase env vars to Vercel

Before the next deploy, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (values from `.env.local`) to the Vercel
project's environment variables — the deployed site has no `.env.local`.

## Remove the localStorage import banner

`src/app/log/ImportLocalMeals.tsx` and the helpers in `src/lib/log.ts` exist
only to migrate meals logged before the database switch. Once the log has been
imported on every device that had one (phone + laptop), delete the component,
strip `readLocalMeals`/`clearLocalMeals` from `src/lib/log.ts`, and remove the
banner from `src/app/log/page.tsx`.

## Paginate the meal log

`listMeals()` fetches every row including thumbnails (~10 KB each). Fine for
months of personal use, but at thousands of entries the page payload gets
heavy — add pagination or lazy day-by-day loading when that day comes.
