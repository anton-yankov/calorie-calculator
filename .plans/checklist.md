# Multi-user rework — checklist

One step at a time: explain the why, implement only that step, stop. Tick `[x]` when done.

## Phase 1 — Accounts & privacy

- [x] 1.1 Turn off public signups; create Supabase Auth users with real emails (you + a test account).
- [x] 1.2 Add `@supabase/ssr` and `createSessionClient()` (`src/lib/supabase-session.ts`), which reads the logged-in session from cookies.
- [x] 1.3 Login page with email + password; "Log out" link under the nav tabs (moves to Settings in 2.8).
- [x] 1.4 `proxy.ts` checks the Supabase session (verified with `getClaims`) and refreshes it; logged out → `/login`, API → 401.
- [-] 1.5 ~~Force a password change on first login~~ — deferred, see below.
- [x] 1.6 `meals.user_id` (SQL + backfill to your account); new meals save the logged-in user as owner; Server Actions check the Supabase session instead of the site password.
- [x] 1.7 `settings` keyed by `user_id` (SQL + backfill); goals are read and saved for the logged-in user.
- [x] 1.8 `barcode_products` keyed by `(user_id, barcode)` (SQL + backfill); list, lookup, save and delete only touch the logged-in user's products.
- [x] 1.9 RLS policies "users manage their own rows" on all 3 tables (SQL); all queries run as the logged-in user; anon access removed.
- [x] 1.10 Verify isolation — logged-out API access denied (42501), ownership SQL correct, in-app two-account test passed.
- [x] 1.11 Removed `src/lib/auth.ts`, `src/lib/supabase.ts`, `SITE_PASSWORD` and `SUPABASE_SECRET_KEY` from `.env.example`/README; README documents invite-only accounts. Production build passes.
- [x] 1.12 Removed dead code: stale `next/headers` test mocks, redundant `meals_logged_at_idx` index, `portion_unit` now `not null` (SQL), old-database fallbacks (water goal, missing settings table, product column sets, portion-unit guessing), commented `alter table` SQL, unneeded `export`s. Re-scan clean.
- [ ] 1.13 Deploy Phase 1: commit + push when you ask (`SITE_PASSWORD` already removed in Vercel), check the live login.

## Phase 2 — Goal setup & plans

- [ ] 2.1 HTML mockups: onboarding flow + both plan styles (3 pace cards vs. slider) → you choose.
- [ ] 2.2 Profile table: height, weight, birth year, sex, activity level, goal weight.
- [ ] 2.3 Maintenance calculator with tests: Mifflin-St Jeor BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- [ ] 2.4 Plan generator with tests: lose 0.25/0.5/0.75 kg/wk, maintain, gain 0.25/0.5 kg/wk; protein 2.0 g/kg; no calorie floor.
- [ ] 2.5 Custom plan: own calories + protein; goal date estimated with 7,700 kcal/kg, or "At this intake it's impossible to reach your goal weight" if it points the wrong way.
- [ ] 2.6 Plan history table so each day is judged by the plan active on that date; targets change only when edited manually.
- [ ] 2.7 Onboarding UI, required for new accounts (you go through it too).
- [ ] 2.8 HTML mockup, then Settings page: profile, plan, water toggle, change password, log out.
- [ ] 2.9 Water off by default; hide all water UI when off (drinks still count as food).

## Phase 3 — Tracking experience

- [ ] 3.1 HTML mockups: goal colours + Log/Stats changes → you choose.
- [ ] 3.2 Goal status logic: lose = calorie ceiling, maintain = ±10%, gain = floor; protein always a floor. Tests.
- [ ] 3.3 Apply goal colours to the goal bars, Today strip and charts.
- [ ] 3.4 Manual quick entry on Log (name, kcal, protein; carbs/fat optional; no AI).
- [ ] 3.5 Stats: calories/protein first, goal-aware "days on track", carbs/fat breakdown, water last and only if enabled.

## Phase 4 — Weight, AI cap & admin

- [ ] 4.1 Weight entries table + log weight any day (one per day).
- [ ] 4.2 Weight chart with trend on Stats.
- [ ] 4.3 Weekly weigh-in nudge after 7 days without an entry.
- [ ] 4.4 Admin role: mark your account as the admin.
- [ ] 4.5 AI usage counting with a per-user daily cap (default 20, admin unlimited, resets at midnight Sofia time).
- [ ] 4.6 Always-visible "analyses left" counter; when the cap is hit, only photo/label AI is blocked.
- [ ] 4.7 HTML mockups: admin users list + user detail.
- [ ] 4.8 Admin users list with editable AI cap.
- [ ] 4.9 Admin user detail (read-only): profile & plan, charts, meals, products, AI usage.

## Phase 5 — Polish & handover

- [ ] 5.1 Helpful empty states on every page.
- [ ] 5.2 Loading and error states audit.
- [ ] 5.3 Final dead-code scan, README refresh, add an `npm test` script.
- [ ] 5.4 Complete every "Pending manual checks" item below, then final run-through with his account, deploy, send him his credentials.

## Pending manual checks

Must be done before he gets his account (5.4).

_None right now._

## Later, non-blocking

Small chores that nothing waits on — do them whenever convenient.

- [ ] **1.12 SQL** (the app works without it; it makes the database match `supabase/schema.sql`):

  ```sql
  begin;
  drop index if exists public.meals_logged_at_idx;
  alter table public.barcode_products alter column portion_unit set not null;
  commit;
  ```

  Check: `select indexname from pg_indexes where tablename = 'meals' order by indexname;` → only `meals_pkey` and `meals_user_logged_at_idx`.
- [ ] Remove the unused `SITE_PASSWORD` line from your local `.env.local`.

## Deferred on purpose

Things we chose not to build yet, and when they'd be worth revisiting.

- **Forced password change on first login (1.5)**: you know his temporary password, but with one trusted friend that's an acceptable risk. He can still change it in Settings (2.8). Revisit when more people join.
- **Creating users in the admin page**: accounts are created in the Supabase dashboard (Authentication → Users). Revisit when adding people becomes frequent.
- **Password reset by email**: needs email setup; for now you set a new password in the Supabase dashboard. Revisit with in-app user management.
- **Browser Supabase client**: nothing in the browser talks to Supabase directly; everything goes through Server Actions. Add one only if a feature needs it, e.g. live updates.
- **Dynamic weight-loss model**: goal dates use the simple 7,700 kcal/kg rule, which overestimates long-term loss. Revisit if the estimated dates turn out clearly wrong.
