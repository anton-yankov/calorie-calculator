import { notFound } from "next/navigation";
import { addDays } from "@/lib/day";
import { DEFAULT_DAILY_CAP, sofiaDay } from "@/lib/ai-usage";
import type { Goal } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase-admin";
import { getViewer, type Viewer } from "@/lib/supabase-session";

/**
 * Data for the admin pages. Everything here reads across users with the
 * secret key, so every admin page and action calls requireAdmin() first.
 */

/** The admin viewing the page; anyone else gets a plain 404, not a hint that the page exists. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();
  return viewer;
}

export interface Account {
  userId: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface AccountSummary extends Account {
  /** The newest plan, or null before setup */
  plan: { goal: Goal; calorieTarget: number; proteinTarget: number } | null;
  /** ISO time of the newest logged meal */
  lastMealAt: string | null;
  aiUsedToday: number;
  /** null for the admin (no cap) */
  dailyCap: number | null;
}

interface AuthUser {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string | null;
  app_metadata: { role?: unknown };
}

const toAccount = (user: AuthUser): Account => ({
  userId: user.id,
  email: user.email ?? "(no email)",
  isAdmin: user.app_metadata.role === "admin",
  createdAt: user.created_at,
  lastSignInAt: user.last_sign_in_at ?? null,
});

/** Every account with what the users list shows, oldest account first. */
export async function listAccounts(): Promise<AccountSummary[]> {
  const db = createAdminClient();
  const today = sofiaDay();
  const [users, plans, usage, limits] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db
      .from("plans")
      .select("user_id, goal, calorie_target, protein_target")
      .order("effective_from", { ascending: true }),
    db.from("ai_usage").select("user_id, used").eq("day", today),
    db.from("ai_limits").select("user_id, daily_cap"),
  ]);
  for (const result of [users, plans, usage, limits]) {
    if (result.error) throw new Error(`Couldn't load accounts: ${result.error.message}`);
  }

  // Oldest first, so the last row seen per user is their current plan
  const planByUser = new Map<string, AccountSummary["plan"]>();
  for (const row of plans.data as {
    user_id: string;
    goal: Goal;
    calorie_target: number;
    protein_target: number;
  }[]) {
    planByUser.set(row.user_id, {
      goal: row.goal,
      calorieTarget: row.calorie_target,
      proteinTarget: row.protein_target,
    });
  }
  const usedByUser = new Map(
    (usage.data as { user_id: string; used: number }[]).map((r) => [r.user_id, r.used]),
  );
  const capByUser = new Map(
    (limits.data as { user_id: string; daily_cap: number }[]).map((r) => [r.user_id, r.daily_cap]),
  );

  const accounts = (users.data.users as AuthUser[])
    .map(toAccount)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // One small query per account: fine for a handful of friends
  const lastMeals = await Promise.all(
    accounts.map(async ({ userId }) => {
      const { data, error } = await db
        .from("meals")
        .select("logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Couldn't load activity: ${error.message}`);
      return (data as { logged_at: string } | null)?.logged_at ?? null;
    }),
  );

  return accounts.map((account, i) => ({
    ...account,
    plan: planByUser.get(account.userId) ?? null,
    lastMealAt: lastMeals[i] ?? null,
    aiUsedToday: usedByUser.get(account.userId) ?? 0,
    dailyCap: account.isAdmin ? null : (capByUser.get(account.userId) ?? DEFAULT_DAILY_CAP),
  }));
}

/** One account, or null when the id doesn't exist. */
export async function getAccount(userId: string): Promise<Account | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return toAccount(data.user as AuthUser);
}

/** Analyses used on each of the last `days` Sofia days, oldest first (0 for untouched days). */
export async function aiUsageHistory(
  userId: string,
  days: number,
): Promise<{ day: string; used: number }[]> {
  const today = sofiaDay();
  const first = addDays(today, -(days - 1));
  const { data, error } = await createAdminClient()
    .from("ai_usage")
    .select("day, used")
    .eq("user_id", userId)
    .gte("day", first);
  if (error) throw new Error(`Couldn't load AI usage: ${error.message}`);
  const used = new Map((data as { day: string; used: number }[]).map((r) => [r.day, r.used]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(first, i);
    return { day, used: used.get(day) ?? 0 };
  });
}

/** An account's daily cap: its own row, else the default; null for the admin. */
export async function dailyCapOf(account: Account): Promise<number | null> {
  if (account.isAdmin) return null;
  const { data, error } = await createAdminClient()
    .from("ai_limits")
    .select("daily_cap")
    .eq("user_id", account.userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the cap: ${error.message}`);
  return (data as { daily_cap: number } | null)?.daily_cap ?? DEFAULT_DAILY_CAP;
}

/** Sets a user's daily cap (a row in ai_limits). */
export async function setDailyCap(userId: string, dailyCap: number): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_limits")
    .upsert({ user_id: userId, daily_cap: dailyCap }, { onConflict: "user_id" });
  if (error) throw new Error(`Couldn't save the cap: ${error.message}`);
}
