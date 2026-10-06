import { WaterTrackingProvider } from "@/components/WaterTracking";
import { listMealTotals } from "@/lib/meals";
import { activeWaterGoal } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase-admin";
import { listWeights } from "@/lib/weights";
import { StatsView } from "@/app/(app)/stats/StatsView";
import { loadPlans, loadProfile, requireAdminOnce } from "../data";
import { GRID } from "../grids";

/** The Stats tab: the user's own Stats page, read-only. */
export default async function AdminUserStatsPage(props: PageProps<"/admin/users/[userId]/stats">) {
  await requireAdminOnce();
  const { userId } = await props.params;
  const db = createAdminClient();
  const [profile, plans, rows, weights] = await Promise.all([
    loadProfile(userId),
    loadPlans(userId),
    listMealTotals(userId, db),
    listWeights(userId, db),
  ]);
  return (
    // Water bars follow this user's setting, not the admin's
    <WaterTrackingProvider enabled={profile?.waterTracking ?? false}>
      <div className={GRID}>
        <StatsView
          rows={rows}
          plans={plans}
          waterGoalMl={activeWaterGoal(profile)}
          weights={weights}
          readOnly
        />
      </div>
    </WaterTrackingProvider>
  );
}
