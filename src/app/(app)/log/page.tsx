import { redirect } from "next/navigation";
import type { LoggedMeal } from "@/lib/log";
import { listMeals } from "@/lib/meals";
import { listPlans, type StoredPlan } from "@/lib/plan-history";
import { activeWaterGoal, getProfile, type Profile } from "@/lib/profiles";
import { getUserId } from "@/lib/supabase-session";
import { LogList } from "./LogList";

// Server component: the log is fetched from Supabase per request (nothing is
// cached — see loading.tsx for the streamed skeleton). Grouping/rendering
// happens in LogList on the client, where the viewer's timezone lives.
export default async function LogPage() {
  // The proxy already sends logged-out visitors to /login; this is the page's own check
  const userId = await getUserId();
  if (!userId) redirect("/login");

  let meals: LoggedMeal[] = [];
  let plans: StoredPlan[] = [];
  let profile: Profile | null = null;
  let loadError: string | null = null;
  try {
    [meals, plans, profile] = await Promise.all([
      listMeals(userId),
      listPlans(userId),
      getProfile(userId),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load the meal log.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10">
      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger lg:col-span-2">
          {loadError} — check your connection and reload.
        </p>
      ) : (
        <LogList meals={meals} plans={plans} waterGoalMl={activeWaterGoal(profile)} />
      )}
    </main>
  );
}
