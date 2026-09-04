-- Meal log table — matches the LoggedMeal shape in src/lib/log.ts.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table public.meals (
  id uuid primary key,
  logged_at timestamptz not null,
  description text not null default '',
  analysis jsonb not null,
  thumbnail text,
  photo text
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

-- The secret key maps to service_role, which needs per-table grants too
-- (RLS doesn't apply to it, but plain table privileges still do).
grant select, insert, update, delete on public.meals to service_role;

-- Daily goals — a single row (the boolean primary key with a check constraint
-- guarantees at most one). Accessed only with the secret key, which bypasses
-- RLS, so no anon policies or grants are needed.
create table public.settings (
  id boolean primary key default true check (id),
  calorie_goal integer not null check (calorie_goal > 0),
  protein_goal integer check (protein_goal > 0)
);

alter table public.settings enable row level security;

grant select, insert, update on public.settings to service_role;

-- Products entered manually after a barcode is missing from Open Food Facts.
-- One row per barcode; a later manual entry replaces the earlier nutrition.
create table public.barcode_products (
  barcode text primary key check (barcode ~ '^[0-9]{7,14}$'),
  name text not null check (length(trim(name)) > 0),
  calories_per_100g double precision not null check (calories_per_100g >= 0),
  protein_per_100g double precision not null check (protein_per_100g >= 0),
  carbs_per_100g double precision not null check (carbs_per_100g >= 0),
  fat_per_100g double precision not null check (fat_per_100g >= 0),
  image_url text,
  updated_at timestamptz not null default now()
);

alter table public.barcode_products enable row level security;

-- Barcode persistence is server-only, like settings. The app's API route is
-- protected by the site password gate and accesses this table with the secret key.
grant select, insert, update, delete on public.barcode_products to service_role;
