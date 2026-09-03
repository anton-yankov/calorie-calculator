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
   Food Facts can be entered manually and are saved for future scans.

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

| Variable                               | Purpose                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`                       | Vision analysis (required)                                                           |
| `VISION_MODEL`                         | Model override; defaults to `gpt-5.6-luna`                                           |
| `SITE_PASSWORD`                        | When set, the whole site sits behind this password                                   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Fallback database key (`anon` role, needs the RLS policies in `supabase/schema.sql`) |
| `SUPABASE_SECRET_KEY`                  | Preferred database key (server-only, bypasses RLS)                                   |

Database: create a Supabase project and run `supabase/schema.sql` in the SQL
Editor. It creates `public.meals` (the log) and `public.settings` (daily
goals), and `public.barcode_products` (manually entered barcode nutrition).

## Deploying

Deploy to Vercel with the same environment variables. `SITE_PASSWORD` is worth
setting there — the app is personal and the OpenAI key is on the other side of
every analyze request. Remaining hardening and deferred work is tracked in
[FUTURE-TASKS.md](FUTURE-TASKS.md).

## Scripts

| Command                       | What it does             |
| ----------------------------- | ------------------------ |
| `npm run dev`                 | Dev server               |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint`                | ESLint                   |
| `npm run typecheck`           | `tsc --noEmit`           |
| `npm run format`              | Prettier                 |
