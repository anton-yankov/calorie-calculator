# Calorie Calculator

A personal meal tracker: photo of a meal in, estimated calories and macros out.
Point it at your plate (or just describe what you ate), correct anything the
model got wrong, log it, and watch the day fill up against your calorie and
protein goals.

Built as a phone-first PWA — add it to your home screen and it opens like an
app.

## How it works

1. **Analyze** — snap or pick a photo on the Analyze page (HEIC is converted
   in-browser, the image is resized client-side to ~200 KB). A vision model
   returns each food with grams, calories, protein/carbs/fat, a confidence
   level, and its assumptions. No photo? Type the meal into the description
   field and analyze text-only.
2. **Correct** — edit grams for instant recalculation (linear rescaling from
   the model's baseline), or describe what's wrong ("that's whole milk, and
   there's butter on the toast") to get a revised estimate in a chat-like
   thread.
3. **Log** — save the meal to the log with a small thumbnail. The log groups
   meals by day in your timezone, shows labeled macro breakdowns per meal and
   per day, and tracks progress bars against your daily goals. Entries can be
   edited (grams and time), re-logged with one tap for repeat meals, or
   deleted with undo.
4. **Scan** — look up packaged foods by barcode. Products missing from Open
   Food Facts can be filled from a photo of the European nutrition label (or
   entered manually), saved with an optional image, and reused on future scans.
   The Products page lists those saved entries and lets you edit their name,
   nutrition, and image, or delete them with undo.
5. **Stats** — calories and protein per day charted against your goals, with
   Monday-to-Sunday weekly-average lines, four headline numbers, and a 7d/30d/90d/All range.
   Longer ranges bucket into Monday-to-Sunday weeks. Every chart has a table
   twin. Days are grouped in your timezone, exactly like the log.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + React + TypeScript
- Tailwind CSS v4
- OpenAI Responses API with strict structured outputs for the vision analysis
- Supabase (Postgres) for the meal log, goals, and saved barcode products
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

| Command                       | What it does             |
| ----------------------------- | ------------------------ |
| `npm run dev`                 | Dev server               |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint`                | ESLint                   |
| `npm run typecheck`           | `tsc --noEmit`           |
| `npm run format`              | Prettier                 |
