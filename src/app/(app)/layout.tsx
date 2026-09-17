import { redirect } from "next/navigation";
import { WaterTrackingProvider } from "@/components/WaterTracking";
import { hasPlan } from "@/lib/plan-history";
import { getProfile } from "@/lib/profiles";
import { getUserId } from "@/lib/supabase-session";

/**
 * Wraps the tracker pages (Analyze, Log, Products, Stats, Settings). The folder
 * in parentheses is a route group: it groups files without appearing in any
 * URL, so these pages keep their paths and only gain this shared layout.
 *
 * Anyone without a plan is sent to onboarding, so no page below has to handle
 * "this user has no targets yet". The water setting is shared from here too.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const [onboarded, profile] = await Promise.all([hasPlan(userId), getProfile(userId)]);
  if (!onboarded) redirect("/onboarding");
  return (
    <WaterTrackingProvider enabled={profile?.waterTracking ?? false}>
      {children}
    </WaterTrackingProvider>
  );
}
