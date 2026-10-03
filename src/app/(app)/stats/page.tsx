import { redirect } from "next/navigation";
import { listMealTotals, type MealTotalRow } from "@/lib/meals";
import { listPlans, type StoredPlan } from "@/lib/plan-history";
import { activeWaterGoal, getProfile, type Profile } from "@/lib/profiles";
import { getUserId } from "@/lib/supabase-session";
import { listWeights, type WeightEntry } from "@/lib/weights";
import { StatsView } from "./StatsView";

// Server component: meal totals, plans, the profile and weigh-ins are fetched from
// Supabase per request (see loading.tsx for the streamed skeleton). Day
// grouping, ranges and chart math happen in StatsView on the client, where the
// timezone lives.
export default async function StatsPage() {
  // The proxy already sends logged-out visitors to /login; this is the page's own check
  const userId = await getUserId();
  if (!userId) redirect("/login");

  let rows: MealTotalRow[] = [];
  let plans: StoredPlan[] = [];
  let profile: Profile | null = null;
  let weights: WeightEntry[] = [];
  let loadError: string | null = null;
  try {
    [rows, plans, profile, weights] = await Promise.all([
      listMealTotals(userId),
      listPlans(userId),
      getProfile(userId),
      listWeights(userId),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load your stats.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:grid lg:max-w-5xl lg:grid-cols-[380px_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-6">
      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger lg:col-span-2">
          {loadError} — check your connection and reload.
        </p>
      ) : (
        <StatsView
          rows={rows}
          plans={plans}
          waterGoalMl={activeWaterGoal(profile)}
          weights={weights}
        />
      )}
    </main>
  );
}
