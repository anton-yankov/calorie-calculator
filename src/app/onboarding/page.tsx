import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasPlan } from "@/lib/plan-history";
import { getProfile } from "@/lib/profiles";
import { getUserId } from "@/lib/supabase-session";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = {
  title: "Set up your plan — Calorie Calculator",
  description: "Tell the tracker about you and pick a plan.",
};

/**
 * Setup lives outside the (app) route group, so its gate can send people here
 * without looping. Anyone who already has a plan is sent back to the app;
 * changing an existing plan will go through Settings instead.
 */
export default async function OnboardingPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  if (await hasPlan(userId)) redirect("/");

  return <OnboardingFlow profile={await getProfile(userId)} />;
}
