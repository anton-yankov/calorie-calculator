import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listPlans } from "@/lib/plan-history";
import { getProfile } from "@/lib/profiles";
import { createSessionClient, getViewer } from "@/lib/supabase-session";
import { listWeights } from "@/lib/weights";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = {
  title: "Settings — Calorie Calculator",
  description: "Your plan, your details, water tracking and your account.",
};

export default async function SettingsPage() {
  // The proxy already sends logged-out visitors to /login; this is the page's own check
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { userId } = viewer;

  const supabase = await createSessionClient();
  const [{ data }, profile, plans, weights] = await Promise.all([
    supabase.auth.getUser(),
    getProfile(userId),
    listPlans(userId),
    listWeights(userId),
  ]);
  // The (app) layout guarantees a plan, which means onboarding saved a profile
  if (!profile) redirect("/onboarding");

  return (
    <SettingsView
      email={data.user?.email ?? ""}
      profile={profile}
      plans={plans}
      latestWeighIn={weights.at(-1) ?? null}
      isAdmin={viewer.isAdmin}
    />
  );
}
