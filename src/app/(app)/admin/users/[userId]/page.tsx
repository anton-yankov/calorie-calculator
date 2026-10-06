import { createAdminClient } from "@/lib/supabase-admin";
import { listWeights } from "@/lib/weights";
import {
  loadAccount,
  loadDailyCap,
  loadPlans,
  loadProfile,
  loadUsage,
  requireAdminOnce,
} from "./data";
import { Overview } from "./Overview";

/** The Overview tab: the account, profile, plan and AI use at a glance. */
export default async function AdminUserOverviewPage(props: PageProps<"/admin/users/[userId]">) {
  await requireAdminOnce();
  const { userId } = await props.params;
  const [account, profile, plans, weights, usage, dailyCap] = await Promise.all([
    loadAccount(userId),
    loadProfile(userId),
    loadPlans(userId),
    listWeights(userId, createAdminClient()),
    loadUsage(userId),
    loadDailyCap(userId),
  ]);
  return (
    <Overview
      account={account}
      profile={profile}
      plans={plans}
      latestWeighIn={weights.at(-1) ?? null}
      usage={usage}
      dailyCap={dailyCap}
    />
  );
}
