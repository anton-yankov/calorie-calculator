import { WaterTrackingProvider } from "@/components/WaterTracking";
import { listMeals } from "@/lib/meals";
import { activeWaterGoal } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase-admin";
import { LogList } from "@/app/(app)/log/LogList";
import { loadPlans, loadProfile, requireAdminOnce } from "../data";
import { LOG_GRID } from "../grids";

/** The Log tab: the user's own Log page, read-only. */
export default async function AdminUserLogPage(props: PageProps<"/admin/users/[userId]/log">) {
  await requireAdminOnce();
  const { userId } = await props.params;
  const [profile, plans, meals] = await Promise.all([
    loadProfile(userId),
    loadPlans(userId),
    listMeals(userId, createAdminClient()),
  ]);
  return (
    // Water bars follow this user's setting, not the admin's
    <WaterTrackingProvider enabled={profile?.waterTracking ?? false}>
      <div className={LOG_GRID}>
        <LogList meals={meals} plans={plans} waterGoalMl={activeWaterGoal(profile)} readOnly />
      </div>
    </WaterTrackingProvider>
  );
}
