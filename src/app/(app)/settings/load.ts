import "server-only";
import { redirect } from "next/navigation";
import { listPlans } from "@/lib/plan-history";
import { getProfile } from "@/lib/profiles";
import { createSessionClient, getViewer } from "@/lib/supabase-session";
import { latestWeighIn } from "@/lib/weights";

/**
 * Everything the Settings pages show: the list on the left (desktop) or on
 * the first screen (phones) needs most of it, and each screen the rest.
 */
export async function loadSettings() {
  // The proxy already sends logged-out visitors to /login; this is the page's own check
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const supabase = await createSessionClient();
  const [{ data }, profile, plans, latest] = await Promise.all([
    supabase.auth.getUser(),
    getProfile(viewer.userId),
    listPlans(viewer.userId),
    latestWeighIn(viewer.userId),
  ]);
  // The (app) layout guarantees a plan, which means onboarding saved a profile
  if (!profile) redirect("/onboarding");
  return {
    email: data.user?.email ?? "",
    isAdmin: viewer.isAdmin,
    profile,
    plans,
    latestWeighIn: latest,
  };
}

export type SettingsData = Awaited<ReturnType<typeof loadSettings>>;
