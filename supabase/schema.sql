-- Meal log table — matches the LoggedMeal shape in src/lib/log.ts.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table public.meals (
  id uuid primary key,
  -- The owner; deleting the user in Supabase Auth deletes their meals too.
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null,
  description text not null default '',
  analysis jsonb not null,
  thumbnail text,
  -- ~800px JPEG data URL for the full-size viewer; null when the meal has no
  -- image. Never selected with the list — fetched on demand when tapped.
  photo text
);

create index meals_user_logged_at_idx on public.meals (user_id, logged_at desc);

-- The app queries as the logged-in user (the `authenticated` role). RLS limits
-- every read and write to rows the user owns; logged-out visitors (`anon`) get nothing.
alter table public.meals enable row level security;

create policy "users manage their own meals" on public.meals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Required because "automatically expose new tables" is disabled for this
-- project: privileges must be granted per table.
grant select, insert, update, delete on public.meals to authenticated;

-- The secret key maps to service_role, which needs per-table grants too
-- (RLS doesn't apply to it, but plain table privileges still do).
grant select, insert, update, delete on public.meals to service_role;

-- Daily goals — one row per user (user_id is the primary key).
create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null check (calorie_goal > 0),
  protein_goal integer check (protein_goal > 0),
  water_goal integer check (water_goal > 0)
);

alter table public.settings enable row level security;

create policy "users manage their own settings" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.settings to service_role;

-- Products entered manually after a barcode is missing from Open Food Facts.
-- Private per user: one row per user per barcode; a later manual entry
-- replaces that user's earlier nutrition.
create table public.barcode_products (
  user_id uuid not null references auth.users (id) on delete cascade,
  barcode text not null check (barcode ~ '^[0-9]{7,14}$'),
  name text not null check (length(trim(name)) > 0),
  calories_per_100g double precision not null check (calories_per_100g >= 0),
  protein_per_100g double precision not null check (protein_per_100g >= 0),
  carbs_per_100g double precision not null check (carbs_per_100g >= 0),
  fat_per_100g double precision not null check (fat_per_100g >= 0),
  image_url text,
  portion_unit text not null check (portion_unit in ('g', 'ml')),
  drink_type text check (drink_type in ('water', 'coffee', 'tea', 'milk', 'juice', 'soft_drink', 'smoothie', 'shake', 'alcohol', 'other')),
  -- Amount (g or ml) prefilled when the barcode is scanned; null starts at 100.
  serving_grams double precision check (serving_grams > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, barcode)
);

alter table public.barcode_products enable row level security;

create policy "users manage their own barcode products" on public.barcode_products
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.barcode_products to authenticated;
grant select, insert, update, delete on public.barcode_products to service_role;
