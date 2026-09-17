# Calorie Calculator

A small, invite-only meal tracker: photo of a meal in, estimated calories and
macros out. Point it at your plate (or just describe what you ate), correct
anything the model got wrong, log it, and watch the day fill up against a plan
built from your body details and goal.

Built as a phone-first PWA — add it to your home screen and it opens like an
app. On desktop the pages use two columns instead of a stretched phone layout.

## How it works

1. **Set up** — on first login you enter sex, birth year, height, weight and
   activity level, pick a goal (lose, maintain or gain) and choose a plan:
   a suggested pace (maintenance from Mifflin-St Jeor, 7,700 kcal per kg,
   protein at 2 g per kg) or your own calorie and protein targets, with the
   date you'd reach your goal weight at that pace.
2. **Analyze** — snap or pick a photo on the Analyze page (HEIC is converted
   in-browser, the image is resized client-side to ~200 KB). A vision model
   returns each food with grams, calories, protein/carbs/fat, a confidence
   level, and its assumptions. No photo? Type the meal into the description
   field and analyze text-only. A strip at the top shows today against your
   targets.
3. **Correct** — edit grams for instant recalculation (linear rescaling from
   the model's baseline), or describe what's wrong ("that's whole milk, and
   there's butter on the toast") to get a revised estimate in a chat-like
   thread.
4. **Log** — save the meal to the log with a small thumbnail, or type a food in
   by hand (no AI). The log groups meals by day in your timezone. Each day's
   bars are judged by the plan that applied that day and coloured by goal:
   losing treats calories as a limit, maintaining as a ±10% range, gaining as a
   floor. Entries can be edited, re-logged with one tap, or deleted with undo.
5. **Scan** — look up packaged foods by barcode. Products missing from Open
   Food Facts can be filled from a photo of the European nutrition label (or
   entered manually), saved with an optional image, and reused on future scans.
   The Products page lists those saved entries for editing or deletion.
6. **Stats** — calories and protein per day with a target line that steps when
   the plan changed, "days on track" for your goal, where the calories come from
   (protein, carbs, fat), and a 7d/30d/90d/All range. Weight has its own chart:
   daily weigh-ins, a smoothed trend (a 10% exponential moving average) and your
   goal weight. Analyze nudges you after a week without a weigh-in. Every chart
   has a table twin.
7. **Settings** — change your plan (earlier days keep theirs), body details,
   optional water tracking and its goal, and your password.

**AI cap.** Each account has a daily number of AI analyses (20 unless changed),
counted per calendar day in Sofia and always shown in the top bar. When
they run out, only the AI stops; barcodes, water and manual entries keep
working. The admin account has no cap and an admin area: every account's
activity (read-only) and an editable daily cap.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + React + TypeScript
- Tailwind CSS v4
- OpenAI Responses API with strict structured outputs for the vision analysis
- Supabase (Auth + Postgres with row-level security) for accounts, the meal log, plans, weigh-ins, saved products and AI usage
- [sonner](https://sonner.emilkowal.ski/) for toasts
- Deployed on Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Environment variables (see `.env.example`):

| Variable                               | Purpose                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                       | Vision analysis (required)                                                                      |
| `VISION_MODEL`                         | Model override; defaults to `gpt-5.6-luna`                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Database key; queries run as the logged-in user under the RLS policies in `supabase/schema.sql` |
| `SUPABASE_SECRET_KEY`                  | Server-only key that skips RLS: the admin pages and refunds of failed AI requests               |

Database: create a Supabase project and run `supabase/schema.sql` in the SQL
Editor. It creates `public.meals` (the log), `public.barcode_products`
(manually entered barcode nutrition), `public.profiles` (body details and the
water setting), `public.plans` (one row per plan change, so each day is
judged by the plan that applied on it), `public.weight_entries` (one weigh-in
per day), and `public.ai_limits` / `public.ai_usage` with the functions that
enforce the daily AI cap (20 analyses a day unless changed on the admin page).

Accounts: the app is invite-only. In the Supabase dashboard, turn off
"Allow new users to sign up" (Authentication → Sign In / Providers), then create
each user under Authentication → Users → Add user with "Auto Confirm User"
ticked. Every meal, goal and saved product belongs to the logged-in user.

Admin: mark one account as the admin in the SQL Editor (it applies from that
account's next login). The admin has no AI cap and gets an "Admin" link in
Settings with every account's activity (read-only) and an editable daily cap:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
where email = 'you@example.com';
```

## Deploying

Deploy to Vercel with the same environment variables. Every page and API route
requires a login, since the OpenAI key is on the other side of every analyze
request.

## Scripts

| Command                       | What it does               |
| ----------------------------- | -------------------------- |
| `npm run dev`                 | Dev server                 |
| `npm run build` / `npm start` | Production build / serve   |
| `npm run lint`                | ESLint                     |
| `npm run typecheck`           | `tsc --noEmit`             |
| `npm test`                    | Unit tests (`node --test`) |
| `npm run format`              | Prettier                   |
