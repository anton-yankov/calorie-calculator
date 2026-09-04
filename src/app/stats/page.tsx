import { listMealTotals, type MealTotalRow } from "@/lib/meals";
import { getGoals, type Goals } from "@/lib/settings";
import { StatsView } from "./StatsView";

// Server component: meal totals and goals are fetched from Supabase per
// request (see loading.tsx for the streamed skeleton). Day grouping, ranges
// and chart math happen in StatsView on the client, where the timezone lives.
export default async function StatsPage() {
  let rows: MealTotalRow[] = [];
  let goals: Goals | null = null;
  let loadError: string | null = null;
  try {
    [rows, goals] = await Promise.all([listMealTotals(), getGoals()]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load your stats.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10">
      <header className="border-b-2 border-foreground pb-6 lg:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Trends</p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Stats
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Calories and protein, day by day, against your goals.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger lg:col-span-2">
          {loadError} — check your connection and reload.
        </p>
      ) : (
        <StatsView rows={rows} goals={goals} />
      )}
    </main>
  );
}
