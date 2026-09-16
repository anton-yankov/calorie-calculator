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

-- Body details behind the maintenance estimate — one row per user, created
-- during onboarding. Latest known weight lives here; each plan keeps its own copy.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text not null check (sex in ('male', 'female')),
  birth_year integer not null check (birth_year between 1900 and 2100),
  height_cm double precision not null check (height_cm > 0),
  weight_kg double precision not null check (weight_kg > 0),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  -- Water tracking is off until the user turns it on in Settings.
  water_tracking boolean not null default false,
  water_goal_ml integer check (water_goal_ml > 0)
);

alter table public.profiles enable row level security;

create policy "users manage their own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Plan history — a new row whenever the plan changes, never edited afterwards,
-- so each day is judged by the plan that applied on it. At most one plan per
-- user per start date: a second change the same day replaces the first.
create table public.plans (
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  -- The chosen pace; null for a custom plan.
  kg_per_week double precision check (kg_per_week >= 0),
  goal_weight_kg double precision check (goal_weight_kg > 0),
  calorie_target integer not null check (calorie_target > 0),
  protein_target integer not null check (protein_target > 0),
  -- Snapshots of what the plan was built from, so old plans still make sense.
  maintenance_kcal integer not null check (maintenance_kcal > 0),
  weight_kg double precision not null check (weight_kg > 0),
  primary key (user_id, effective_from),
  -- Maintaining has no goal weight; losing and gaining always have one.
  check ((goal = 'maintain') = (goal_weight_kg is null))
);

alter table public.plans enable row level security;

create policy "users manage their own plans" on public.plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.plans to service_role;
