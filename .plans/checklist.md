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

Decisions: every request that reaches OpenAI uses one analysis (photo, description, correction, label scan), and a failed call gives it back; water shorthand, barcodes and quick entry are free. Weight is logged on Stats and never changes the plan (Settings pre-fills the latest entry). Trend = exponential moving average (10% a day) plus a dashed goal-weight line. Nudge = dismissible banner on Analyze (hidden until the next day). Your counter shows "∞". Admin sees everything read-only, including photos.

- [x] 4.1 Mockups ([postplan](https://szja98kdtm7b.postplan.dev), `.plans/weight-and-ai-cap-mockups.html`): weight on Stats, trend explainer, weigh-in nudge, "analyses left" counter options, cap-reached state. Chosen: phone counter = slim strip under the tabs (desktop = pill beside the tabs); amber at 3 or fewer left; weight tiles + form in the left column, chart + entries on the right.
- [x] 4.2 `weight_entries` table (one per user per day, RLS) + backfill from each plan's weight snapshot; in `supabase/schema.sql` and run (1 row: 16.09, 70 kg).
- [x] 4.3 Log weight on Stats (`WeightLog.tsx`, actions in `stats/actions.ts`, data in `src/lib/weights.ts`): value + day (same day replaces, with a hint), "All weigh-ins" list with edit/delete/undo; also on an empty Stats page. Onboarding saves the first weigh-in; Settings pre-fills its weight from the latest weigh-in.
- [x] 4.4 Weight chart (`WeightChart.tsx`, math in `src/lib/weight-trend.ts`): weigh-ins as dots by date, 10% EMA trend in the goal tint, dashed goal weight, hover/tap + table; "Latest weight" and "Trend change" tiles (trend in effect on the range's first day → last weigh-in). "All" reaches back to the first weigh-in.
- [x] 4.5 Weigh-in nudge (`WeighInNudge.tsx`): banner on Analyze when the latest weigh-in is 7+ days old (or missing), "Log weight" → `/stats#weight`, × hides it until tomorrow (localStorage).
- [x] 4.6 Admin role: `getViewer()` in `supabase-session.ts` reads `app_metadata.role` from the verified token. **SQL still to run + log out and in** (see the Phase 4 SQL item below).
- [x] 4.7 AI usage (`src/lib/ai-usage.ts`): `ai_limits` (own cap, default 20; users can only read it, so the cap lives outside `profiles`) and `ai_usage` per Sofia day; `claim_ai_analysis()` checks and counts in one statement (admin uncapped); both AI routes claim right before OpenAI and refund anything not delivered via the secret-key-only `refund_ai_analysis`. Unchecked = refused (503). **SQL still to run.**
- [x] 4.8 Counter (`AiAllowance.tsx`): slim strip under the tabs below lg, pill beside them on lg; amber at ≤3, red at 0, "∞" for admin; refreshed on navigation, tab focus and after each AI request. Cap reached: message on Analyze, photo + corrections paused, text still sent (water shorthand is free), label scan paused with a hint.
- [x] 4.9 Mockups ([postplan](https://nq54v552uk6w.postplan.dev), `.plans/admin-mockups.html`). Taken as recommended: way in = "Admin" section in Settings; user detail = tabs reusing Log/Stats/Products read-only; cap 0–1000 (0 pauses AI).
- [x] 4.10 Admin gate: `requireAdmin()` (`src/lib/admin.ts`) → 404 for everyone else; secret-key client in `src/lib/supabase-admin.ts` (`server-only`); read functions take an optional client (`Db`).
- [x] 4.11 `/admin`: table on desktop, cards on phones — email (you/admin tag), current plan, last meal, AI today, cap field + Save (`setDailyCapAction`, admin-checked).
- [x] 4.12 `/admin/users/[userId]`: tabs Overview (details, plan history, 14-day AI use) · Log · Stats · Products, reusing the real views with `readOnly` (no quick entry, weight form, edit/delete/relog; thumbnails only) and the user's own water setting.
- [x] 4.13 Phase 4 dead-code scan clean (only the pre-existing 5.3 exports). README and `.env.example` document the secret key, new tables and admin setup. Committed and pushed (`106c16b`).
- [x] **Phase 4 SQL** run on 16.09: AI tables + functions; your account is the only admin (the other account has no role). Log out and in once so the token carries it.

## Phase 5 — Polish & handover

Decisions: `test@gmail.com` is a test account (use it for the 5.4 run-through, delete it afterwards); Stats shows the weight section even without meals; you trigger the independent review yourself once 5.1–5.4 are done; I open the PR only when you ask, and you merge it.

- [x] 5.1 Empty states walked through for a fresh account: Stats now renders fully without meals (a "Nothing to chart yet" banner on top, weight section working); read-only admin views use neutral empty text.
- [x] 5.2 `src/app/error.tsx` (Try again / Go to Analyze, digest shown, inside the normal nav), styled `src/app/not-found.tsx` (unknown URLs and non-admin `/admin`), loading screens for Settings, `/admin` and user detail (`SkeletonPanels`). No `global-error`: the root layout fetches nothing.
- [x] 5.3 Dead-code scan clean: the listed exports are now file-private, no export is used only in its own file, every dependency is used. README describes the app as it is now; `npm test` runs the suite.
- [ ] 5.4 Complete every "Pending manual checks" and "Later, non-blocking" item below, then the final run-through (script given in chat on 17.09) with `test@gmail.com`. After your own UI review: ask me to run the independent agent review.
- [x] 5.4b Independent review (two Fable 5.1 agents: security + AI cap; numbers/dates + handover): no critical/high issues. Fixed: unreadable-label refunds, OpenAI timeout/`maxDuration`, paused-cap wording, text-size limits, Log/admin dates rendered only in the browser, Settings plan preview from saved details, whole-unit goal judging ("Over by 0"), "Yesterday" on DST days, onboarding kg noise, "1,200" in quick entry. Deferred: A3 below.
- [ ] 5.5 PR opened: https://github.com/anton-yankov/calorie-calculator/pull/13. When you ask: I open one PR from `feat/multi-user-rework` into `main`; you review and merge (Vercel deploys); check the live site; then you create his account and send him his credentials.

## Redesign (branch `feat/redesign`, one PR into `main` at the end)

Decisions and mocks: `.plans/redesign/0-decisions-and-build-plan.html` ([postplan](https://9va32v4ynyap.postplan.dev)), mocks 1–8 in the same folder. SQL is given in chat at the step that needs it.

### Phase R1 — Foundations, shell & states

- [x] R1.1 Design tokens: style C colours on the existing token names, `--radius-panel` 14px, Inter only (serif/mono utilities point at Inter until the R4.3 scan).
- [x] R1.2 `lucide-react` installed; gear, ∞, date-picker chevron, spinner, product barcode placeholder and the ✕ close buttons now use its icons.
- [x] R1.3 `Button` / `ButtonLink` (`src/components/Button.tsx`): primary, secondary, outline, destructive; sizes md 48px, sm 44px, icon 44px square; `pending` shows the spinner. New `--line-strong` token for outline borders.
- [-] R1.4 Moved to R2.7, where the first sheet is needed, so Phase R1 leaves no unused code.
- [x] R1.5 `fields.tsx` restyled (48px fields, equal-width segmented buttons, choice cards with a visible radio); toasts: filled circular marks (`ToastMark`, "!" for errors), rounded raised background, tinted Undo button. Also fixed: the global `font: inherit` on buttons/inputs moved into `@layer base`, so weight and size utilities on buttons work again.
- [x] R1.6 `TopNav`: page title row (`pageTitle` in `src/components/nav.ts`), underlined Home · Log · Stats · Products tabs on phones, profile button to Settings (peach in Settings/admin); onboarding keeps Log out; no nav on /login. AI strip and desktop pill removed (phone count returns on the homepage in R2.2).
- [x] R1.7 `Sidebar` (lg only, sticky full height): pages with lucide icons, `AiCounterCard` (left of cap with amber/red bar, ∞ for admin, Paused), Settings. Root layout is now sidebar + page column.
- [x] R1.8 Big serif headers removed from every page and loading screen; padding px-4 (lg px-8); desktop sticky columns now `lg:top-6`; admin account page gets a back button + email line. "Analyze page" wording → homepage.
- [x] R1.9 App icon I2 (`src/app/icon.svg`), PNGs regenerated with `scripts/generate-icons.mjs`, manifest colours #1a1720.
- [x] R1.10 Login redesigned (phone: icon, name, tagline, form with error box above the fields; desktop: split with a decorative preview), error page and 404 with icon tiles and real buttons, skeleton cards restyled (shapes follow each page as it's redesigned).

### Phase R2 — Homepage, Log & Products

- [x] R2.1 Today cards (`home/TodayCards.tsx`): calories and protein, headline from the new `dayChip` ("910 left", "Over by 140", "On track"; tests), 120% track with tick, maintain range shaded. Replaces the Today strip and `GoalBars`.
- [x] R2.2 `AddFood`: Snap your meal with the AI count, Describe · Barcode · Manual; used-up and paused states grey out Photo/Describe only.
- [x] R2.3 `ComposeCard`: description and/or photo (Change, Add photo), Enter analyzes, ✕ starts over.
- [x] R2.4 `AnalyzingCard`: live seconds from `loadingSince` (kept in the provider, so it survives navigation), "Taking longer than usual" after 30 s, sliding bar. Failed analyses show in `FailedCard` with Try again.
- [x] R2.5 `EstimateCard`: weights as fields, confidence chips, ▲/▼ vs the previous estimate, "Done in N s", totals, "After this meal", day picker + Log; earlier estimates fold into one line; `CorrectionCard` with Re-analyze / Start over.
- [x] R2.6 Logging resets the page (`handleLog` returns the new meal), toast with Undo, the new meal tinted in the list. `loggedAtLength` and the old View log / New meal buttons are gone.
- [x] R2.7 `Sheet` (native `<dialog>`: bottom sheet on phones, dialog on desktop, Escape/backdrop close; the date picker now opens inside it). `ManualSheet` (quick entry moved from Log), `BarcodeFlow` (scanner → `ProductSheet` or the new-product form with label scan; joins the meal being made, otherwise logs on its own).
- [x] R2.8 `EatenToday` (from `todayProgressAction`, which now also returns the day's meals) with shared `MealRow`, `MealMenu` (Edit / Log again / Delete, Undo toasts) and `EditMealSheet`.
- [x] R2.9 `WeighInCard`: save in place, "Saved · −0.4 kg since…", ✕ = snooze sheet (tomorrow / in 3 days, this browser). "Change how often" comes with R3.12.
- [x] R2.10 `WaterRow` (only with water tracking), empty-day card, desktop: sticky add column + wide right column (same elements, reordered with `contents`/`order`).
- [x] R2.11 Log rebuilt: day cards with status chip + slim bars, meals in eating order that open in place (photo, foods, macros, Edit / Log again / Delete), shared edit sheet, desktop `MonthCalendar` rail that jumps to a day, `/log#day-…` anchors for Stats, empty state with a button. Quick entry removed from the Log.
- [x] R2.12 Products rebuilt: rows with the default amount, search (> 5 products), ⋯ sheet with Log it now (`ProductSheet`) / Edit / Delete, edit sheet without the g/ml switch (unit follows the product) and with the macro split, 2–3 column grid on desktop, empty state linking to `/?scan=1`.

### Phase R3 — Setup, Stats & Settings

- [x] R3.1 `PROTEIN_LEVELS` (Light 1.2 / Moderate 1.6 default / High 2.0 g/kg) and `proteinTarget` in `plan.ts`: goal weight when losing, current weight otherwise; `suggestPlans` takes the level. Tests.
- [x] R3.2 `plans.protein_per_kg` (in `schema.sql`; **SQL to run**, see below): `validProteinPerKg`, stored by setup and Change plan (null for custom). Tests.
- [x] R3.3 `PlanPicker` rebuilt: maintenance with How we got this, Custom plan card under it (clearer can't-work message), P1 protein bar, pace cards, `PinnedAction` button at the bottom; maintain preselects its one plan.
- [x] R3.4 Setup rebuilt: Back / Step N of 3 / Log out row, progress bar, choice cards (goal icons), pinned Continue; desktop step 3 in two columns. The top bar is hidden during setup.
- [x] R3.5 Stats: Nutrition · Weight · Water switch, range pills, days on track with ▲/▼ vs the period before (`onTrackBefore`, tests).
- [x] R3.6 `WeeksCalendar` (7d/30d) and `MonthCalendar` (90d/All, one full month each with its score), large dates, `dayOutcome` (tests), tap opens `/log#day-…`.
- [x] R3.7 Two average tiles with plain captions, restyled charts, macro split, insight card from `pickInsight` (five fixed checks, no AI; tests).
- [x] R3.8 Weight: journey card (plan start → now → goal, "at your pace so far" from `trendPace`, tests), Log weight sheet, tiles, chart with a smooth monotone trend (`curve.ts`, tests; goal line only when near the data), weigh-ins with ⋯ edit/delete and Show all.
- [x] R3.9 Water section (tiles, chart, by drink), empty state with Add a meal / Go to Weight, desktop columns. `StatTile`/`RangePicker` removed.
- [x] R3.10 Settings list (`SettingsMenu`): plan card, You / Tracking / Account / Admin rows with their current values; `SettingsShell` (list + section on desktop).
- [x] R3.11 `/settings/details` and `/settings/plan` as their own screens (real URLs, back button on phones), shared `loadSettings`; `SettingsView` removed.
- [x] R3.12 `profiles.weigh_in_reminder_days` (in `schema.sql`; **SQL to run**): reminder sheet (daily / 3 / 7 / 14 days / off, `saveReminderAction`, test), the homepage card follows it and its snooze sheet links to it.
- [x] R3.13 Water switch with an autosaving goal, password and plan-history sheets, Log out row, desktop list + detail.

- [ ] **Phase R3 SQL** (run before using this branch: every page reads both columns):
  `alter table public.plans add column protein_per_kg numeric(2,1) check (protein_per_kg in (1.2, 1.6, 2.0));`
  `alter table public.profiles add column weigh_in_reminder_days smallint not null default 7 check (weigh_in_reminder_days in (0, 1, 3, 7, 14));`

### Phase R4 — Admin & finish

- [x] R4.1 Users: totals (accounts, active today, AI today), account cards with activity dot, plan and AI bar (amber at ≤3 left), desktop table, `CapButton` sheet (Pause · 10 · 20 · 50 · 100 + 0–1000).
- [x] R4.2 Account page: Read-only chip, plan / last login / AI today, Overview · Log · Stats · Products switch, restyled Overview with Change AI cap. ("Last login" stands in for the mock's "Last meal": no new data.)
- [x] R4.3 Dead-code scan clean: last serif/mono classes and their theme entries removed, every file imported, no export used only in its own file, every colour token used, stale comments (quick entry, counter under the nav) updated.
- [x] R4.4 README describes the redesigned app. **Manual run-through: yours** (see Pending manual checks).
- [ ] R4.5 PR `feat/redesign` → `main` when asked.

## Pending manual checks

- [ ] Redesign run-through on a phone and a laptop before merging the redesign PR: setup (protein levels, custom plan), homepage (photo, describe, barcode, manual, correction, log + undo, weigh-in card and snooze), Log (open, edit, log again, delete, calendar jump), Products (search, Log it now, edit), Stats (ranges, calendar tap, log weight), Settings (details, change plan, reminder, water, password), Users and an account page (cap sheet).

Must be done before he gets his account (5.4).

- [x] Vercel: `SUPABASE_SECRET_KEY` is set and matches the current secret key (confirmed 17.09).
- [ ] Tell your friend that the admin view lets you see his meals and photos.
- [ ] Delete the `test@gmail.com` account after the 5.4 run-through (Authentication → Users; its data goes with it).

## Later, non-blocking

Small chores that nothing waits on — do them whenever convenient.

- [x] **1.12 SQL** run on 17.09 (old `meals_logged_at_idx` gone, `portion_unit` not null).
- [ ] Remove the unused `SITE_PASSWORD` line from your local `.env.local`.

## Deferred on purpose

Things we chose not to build yet, and when they'd be worth revisiting.

- **Forced password change on first login (1.5)**: you know his temporary password, but with one trusted friend that's an acceptable risk. He can still change it in Settings (2.8). Revisit when more people join.
- **Creating users in the admin page**: accounts are created in the Supabase dashboard (Authentication → Users). Revisit when adding people becomes frequent.
- **Password reset by email**: needs email setup; for now you set a new password in the Supabase dashboard. Revisit with in-app user management.
- **Browser Supabase client**: nothing in the browser talks to Supabase directly; everything goes through Server Actions. Add one only if a feature needs it, e.g. live updates.
- **De-duplicating `getUserId()` per request**: each call verifies the token locally (under a millisecond, no network), so repeating it is cheap. Revisit when one page render calls it several times (e.g. layout + page + onboarding gate): wrap it in React `cache()`.
- **AI refund across midnight (review A3)**: a request that starts just before Sofia midnight and fails just after gives its analysis back to the new day. Harmless for two users; fixing it means passing the claimed day to `refund_ai_analysis` (a SQL change). Revisit if caps get tight.
- **Dynamic weight-loss model**: goal dates use the simple 7,700 kcal/kg rule, which overestimates long-term loss. Revisit if the estimated dates turn out clearly wrong.
