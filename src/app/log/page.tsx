import type { LoggedMealSummary } from "@/lib/log";
import { listMeals } from "@/lib/meals";
import { getGoals, type Goals } from "@/lib/settings";
import { GoalsEditor } from "./GoalsEditor";
import { LogList } from "./LogList";

// Server component: the log is fetched from Supabase per request (nothing is
// cached — see loading.tsx for the streamed skeleton). Grouping/rendering
// happens in LogList on the client, where the viewer's timezone lives.
export default async function LogPage() {
  let meals: LoggedMealSummary[] = [];
  let goals: Goals | null = null;
  let loadError: string | null = null;
  try {
    // getGoals never throws — a missing settings table just means "no goals yet"
    [meals, goals] = await Promise.all([listMeals(), getGoals()]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load the meal log.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:max-w-3xl">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Daily record
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Meal log
        </h1>
        <p className="mt-2 text-[15px] text-muted">Your saved meals, grouped by day.</p>
      </header>

      <GoalsEditor goals={goals} />

      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {loadError} — check your connection and reload.
        </p>
      ) : (
        <LogList meals={meals} goals={goals} />
      )}
    </main>
  );
}
