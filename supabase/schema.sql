-- Meal log table — matches the LoggedMeal shape in src/lib/log.ts.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table public.meals (
  id uuid primary key,
  logged_at timestamptz not null,
  description text not null default '',
  analysis jsonb not null,
  thumbnail text
);

create index meals_logged_at_idx on public.meals (logged_at desc);

-- The app reads/writes this table only from server code (behind the site
-- password gate) using the publishable key, which maps to the `anon` role.
-- When a secret key is added later (see FUTURE-TASKS.md), drop the anon
-- policies and grants below.
alter table public.meals enable row level security;

create policy "anon can read meals" on public.meals
  for select to anon using (true);

create policy "anon can insert meals" on public.meals
  for insert to anon with check (true);

create policy "anon can delete meals" on public.meals
  for delete to anon using (true);

-- Required because "automatically expose new tables" is disabled for this
-- project: privileges must be granted per table.
grant select, insert, delete on public.meals to anon;
