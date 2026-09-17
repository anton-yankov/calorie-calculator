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

-- Weigh-ins — at most one per user per day: logging the same day again
-- replaces that day's entry. They feed the Stats weight chart and never change
-- a plan on their own.
create table public.weight_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  weight_kg double precision not null check (weight_kg > 0),
  primary key (user_id, day)
);

alter table public.weight_entries enable row level security;

create policy "users manage their own weight entries" on public.weight_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.weight_entries to authenticated;
grant select, insert, update, delete on public.weight_entries to service_role;

-- AI analyses. The admin is marked in auth.users.raw_app_meta_data
-- ({"role": "admin"}), which only the server can write and which reaches the
-- login token at the next sign-in; the admin has no daily cap.

-- A user's own daily cap; users without a row get 20. Users can read theirs,
-- only the secret key (the admin page) can change it.
create table public.ai_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_cap integer not null check (daily_cap between 0 and 1000)
);

alter table public.ai_limits enable row level security;

create policy "users read their own ai limit" on public.ai_limits
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.ai_limits to authenticated;
grant select, insert, update, delete on public.ai_limits to service_role;

-- Analyses used per user per day, a day being a calendar day in Sofia. Users
-- can read their count but never write it: only the functions below change it.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used integer not null check (used >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

create policy "users read their own ai usage" on public.ai_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

-- Checks the cap and counts one analysis in a single statement, so two requests
-- at the same moment can't both slip under it. Runs with the owner's rights
-- (security definer) because users can't write ai_usage themselves; it only
-- ever touches the caller's own row.
create function public.claim_ai_analysis()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Sofia')::date;
  cap integer;
  used_now integer;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  -- null = unlimited
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    cap := coalesce((select l.daily_cap from public.ai_limits l where l.user_id = uid), 20);
  end if;

  if cap is null or cap > 0 then
    insert into public.ai_usage as u (user_id, day, used)
    values (uid, today, 1)
    on conflict (user_id, day) do update
      set used = u.used + 1
      where cap is null or u.used < cap
    returning u.used into used_now;
  end if;

  if used_now is not null then
    return jsonb_build_object('allowed', true, 'used', used_now, 'cap', cap);
  end if;

  select u.used into used_now from public.ai_usage u where u.user_id = uid and u.day = today;
  return jsonb_build_object('allowed', false, 'used', coalesce(used_now, 0), 'cap', cap);
end;
$$;

revoke execute on function public.claim_ai_analysis() from public, anon;
grant execute on function public.claim_ai_analysis() to authenticated;

-- Gives back an analysis whose AI request failed. Secret key only: a user who
-- could call it could refund themselves forever.
create function public.refund_ai_analysis(p_user uuid)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage
  set used = used - 1
  where user_id = p_user
    and day = (now() at time zone 'Europe/Sofia')::date
    and used > 0;
$$;

revoke execute on function public.refund_ai_analysis(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_analysis(uuid) to service_role;
