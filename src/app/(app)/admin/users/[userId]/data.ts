import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { aiUsageHistory, getAccount, requireAdmin, storedDailyCap } from "@/lib/admin";
import { listPlans } from "@/lib/plan-history";
import { getProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * The reads the header (layout) and the tabs share. `cache` dedupes them
 * within one request, so a full page load fetches each once even though both
 * the layout and the page ask; switching tabs renders only the page.
 */

export const requireAdminOnce = cache(requireAdmin);

/** The account, or a 404 when the id doesn't exist. */
export const loadAccount = cache(async (userId: string) => {
  const account = await getAccount(userId);
  if (!account) notFound();
  return account;
});

export const loadProfile = cache((userId: string) => getProfile(userId, createAdminClient()));

export const loadPlans = cache((userId: string) => listPlans(userId, createAdminClient()));

/** The last 14 days of AI use, which the header (today) and Overview (the chart) both show. */
export const loadUsage = cache((userId: string) => aiUsageHistory(userId, 14));

/** The cap row loads alongside the account; null for the admin (no cap). */
export const loadDailyCap = cache(async (userId: string) => {
  const [account, cap] = await Promise.all([loadAccount(userId), storedDailyCap(userId)]);
  return account.isAdmin ? null : cap;
});
