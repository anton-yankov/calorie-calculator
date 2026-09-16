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
- [x] 1.13 Review fix: session cookies `HttpOnly` + `Secure` (in production) via shared `src/lib/supabase-config.ts`.
- [x] 1.14 Review fix: both AI routes check the session themselves; the proxy's 401 is JSON like the route handlers'.
- [x] 1.15 Review fix: remove redundant `connection()` calls (reading cookies already makes pages dynamic).
- [x] 1.16 Review fix: one scoping pattern — every data function takes `userId` first and filters by it; `isAuthed()` gone; `user_id` added at insert only; `settings` delete grant for `service_role`; logged-out action test.
- [x] 1.17 Committed and pushed to `feat/multi-user-rework` — all phases live on this branch; one PR to `main` at the end (5.5). `SITE_PASSWORD` already removed in Vercel.

## Phase 2 — Goal setup & plans

Decisions: maintain skips goal weight; your first plan also covers all earlier days; a plan change starts today; "water 500" still logs when water is off; changing password asks for the current one; Settings opens from a gear icon in the top bar.

- [x] 2.1 HTML mockups ([postplan](https://jlr7u9cwep6y.postplan.dev), `.plans/onboarding-plan-mockups.html`). Chosen: option A (three pace cards) + "Set my own"; "Recommended" badge on lose 0.5 / gain 0.25 kg/wk; expandable "How we got this"; tabs hidden during onboarding (Log out only); progress bar + "Step N of 3".
- [x] 2.2 Maintenance calculator in `src/lib/plan.ts` (`bmr`, `maintenanceCalories`) with tests in `tests/plan.test.mjs`: Mifflin-St Jeor BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- [x] 2.3 Plan generator `suggestPlans` with tests: lose 0.25/0.5/0.75 kg/wk, maintain, gain 0.25/0.5 kg/wk; daily adjustment pace × 7,700 ÷ 7; protein 2.0 g/kg; goal date via `addDays`; one recommended plan per goal; no calorie floor.
- [x] 2.4 Custom plan `customPlanOutlook` with tests: own calories → reachable (pace + recalculated goal date), impossible (shown as "At this intake it's impossible to reach your goal weight"), or the weekly change when maintaining. Protein is stored as typed.
- [x] 2.5 `profiles` + `plans` tables: `src/lib/profiles.ts` (`getProfile`, `saveProfile`), `src/lib/plan-history.ts` (`listPlans`, `savePlan`), RLS policies, tests. Goal weight lives on the plan; water columns come in 2.9. SQL run.
- [x] 2.6 Onboarding gate: tracker pages moved into `src/app/(app)/` whose layout redirects users without a plan (`hasPlan`) to `/onboarding`; placeholder onboarding page; nav tabs hidden there (Log out stays).
- [x] 2.7 Onboarding UI: `OnboardingFlow` (details → goal → pick a plan, live maintenance + "How we got this", pace cards, "Set my own") and `saveOnboardingAction`, which revalidates inputs, recomputes targets server-side and stores the profile + first plan. 8 tests.
- [x] 2.8 Use plan targets everywhere: new `src/lib/plan-targets.ts` (`planForDay`, `targetsForDay`, oldest plan covers earlier days); `GoalBars` takes a day's targets; Log, Today strip (`todayProgressAction` now takes the day key) and Stats pass the plan history. Water goal still from `settings` until 2.9. 4 tests.
- [x] 2.9 Removed `settings` table, `src/lib/settings.ts`, `GoalsEditor` and `saveGoalsAction`; `water_tracking` + `water_goal_ml` now live on `profiles` with `activeWaterGoal()`. SQL run.
- [x] 2.10 Settings page ([mockup](https://voml7535uqx7.postplan.dev)): gear in the top bar, plan card + history + "Change plan" (shared `PlanPicker` with setup), details with live maintenance, water toggle + goal, change password (checks the current one), log out. Logout now calls `revalidatePath("/", "layout")`; login errors distinguish rate-limit/banned/server problems. Shared `src/lib/profile-input.ts` + `src/components/fields.tsx`. Desktop (`lg`) gets a 2fr/3fr grid: sticky plan rail left, forms right. 9 tests.
- [x] 2.11 Water off by default: `WaterTrackingProvider`/`useWaterTracking()` (filled by the `(app)` layout) hides drink-type selectors, water lines, the Stats water tiles/charts, the Analyze quick-water buttons and hint when off; drinks still count as food and "water 500" still logs. Verified live with tracking off.
- [x] 2.12 Phase 2 dead-code scan clean (unneeded exports and the unread `DayTargets.goal` removed, stale comment fixed), committed and pushed to `feat/multi-user-rework`.

## Phase 3 — Tracking experience

- [x] 3.1 Mockups ([postplan](https://fgo2gciwdace.postplan.dev), `.plans/tracking-experience-mockups.html`). Chosen: style B (goal-tinted progress: lose blue, maintain stone, gain terracotta; green met, amber near/short, red over); track to 120% with a target tick; amber from 90% of the ceiling when losing (today only); quick entry = name, kcal, protein, optional carbs/fat, day; Log desktop gets a sticky left rail; Stats goal line steps with plan history; macro split as share of calories.
- [x] 3.2 `src/lib/goal-status.ts`: `goalStatus` (progress / near / met / short / over; lose = ceiling with amber from 90% today, maintain = ±10%, gain = floor, protein = floor; only finished days fall short) and `statusMessage` (maintain distances measured to the range edges). 7 tests incl. a rounding sweep over every target 1,200–5,000.
- [x] 3.3 Goal colours applied (style B via `src/components/goal-colors.ts` + tokens in `globals.css`): `GoalBars` has the 120% track, target tick, shaded maintain range and a status line, judged per day (`isToday` from the Log and Today strip); water is a floor. Charts colour each bar by that day's status and draw a dashed target line that steps with plan changes. `DayTargets.goal` is back now that bars read it.
- [x] 3.4 Quick entry on Log (`QuickEntry.tsx`, parsing in `src/lib/quick-entry.ts`): name, kcal, protein, optional carbs/fat, day picker; no AI. Foods carry `quickEntry: true` (✍ icon, "manual" tag, no grams to scale). Desktop Log is now a sticky rail (today's bars + open form) beside the days; Analyze's Today strip shows a skeleton while loading.
- [x] 3.5 Stats: calorie/protein tiles and charts first; "Days on track" counts finished days whose calories were `met` for that day's goal (same `goalStatus` as the bars), "Protein reached" likewise; "Where the calories come from" split (4/4/9 kcal per g, `macroSplit` in `stats.ts`); water tiles, chart and drinks last, only when tracking is on. The no-plan "Biggest day" tile is gone, and days logged moved into the range line.
- [x] 3.6 Phase 3 dead-code scan clean (no orphan files, unused CSS variables or stale notes; removed a dead "weekly" legend branch in `DailyBars`). Only the pre-existing exports listed in 5.3 remain. Commit and push when you ask.

## Phase 4 — Weight, AI cap & admin

- [ ] 4.1 Weight entries table + log weight any day (one per day).
- [ ] 4.2 Weight chart with trend on Stats.
- [ ] 4.3 Weekly weigh-in nudge after 7 days without an entry.
- [ ] 4.4 Admin role: mark your account as the admin (in `app_metadata`, so the verified token carries it without a database lookup).
- [ ] 4.5 AI usage counting with a per-user daily cap (default 20, admin unlimited, resets at midnight Sofia time).
- [ ] 4.6 Always-visible "analyses left" counter; when the cap is hit, only photo/label AI is blocked.
- [ ] 4.7 HTML mockups: admin users list + user detail.
- [ ] 4.8 Admin users list with editable AI cap.
- [ ] 4.9 Admin user detail (read-only): profile & plan, charts, meals, products, AI usage.

## Phase 5 — Polish & handover

- [ ] 5.1 Helpful empty states on every page.
- [ ] 5.2 Loading and error states audit.
- [ ] 5.3 Final dead-code scan (incl. pre-existing exports only used in their own file: `parseDrinkAmount`, `MAX_PRODUCT_IMAGE_LENGTH`, `HistoryEntry`, `LightboxImage`, `NutritionLabelBasis`, `DayStat`/`Bucket`/`Summary`), README refresh, add an `npm test` script.
- [ ] 5.4 Complete every "Pending manual checks" and "Later, non-blocking" item below, then a final run-through on the branch.
- [ ] 5.5 Open one PR from `feat/multi-user-rework` into `main`, review, merge (Vercel deploys), check the live site, then create his account and send him his credentials.

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

  Check: `select indexname from pg_indexes where tablename = 'meals' order by indexname;` → only `meals_pkey` and `meals_user_logged_at_idx`. Best done before the 1.17 deploy if the dashboard is back.
- [ ] Remove the unused `SITE_PASSWORD` line from your local `.env.local`.

## Deferred on purpose

Things we chose not to build yet, and when they'd be worth revisiting.

- **Forced password change on first login (1.5)**: you know his temporary password, but with one trusted friend that's an acceptable risk. He can still change it in Settings (2.8). Revisit when more people join.
- **Creating users in the admin page**: accounts are created in the Supabase dashboard (Authentication → Users). Revisit when adding people becomes frequent.
- **Password reset by email**: needs email setup; for now you set a new password in the Supabase dashboard. Revisit with in-app user management.
- **Browser Supabase client**: nothing in the browser talks to Supabase directly; everything goes through Server Actions. Add one only if a feature needs it, e.g. live updates.
- **De-duplicating `getUserId()` per request**: each call verifies the token locally (under a millisecond, no network), so repeating it is cheap. Revisit when one page render calls it several times (e.g. layout + page + onboarding gate): wrap it in React `cache()`.
- **Dynamic weight-loss model**: goal dates use the simple 7,700 kcal/kg rule, which overestimates long-term loss. Revisit if the estimated dates turn out clearly wrong.
