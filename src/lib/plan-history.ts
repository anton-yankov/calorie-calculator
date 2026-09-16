import type { Goal } from "@/lib/plan";
import { createSessionClient, type Db } from "@/lib/supabase-session";

/**
 * Server-side data layer for public.plans: every plan a user has had, one per
 * start date. A plan is never edited afterwards (changing plans adds a row), so
 * each past day can be judged by the plan that applied on it. Every function
 * takes the logged-in user's id first and filters by it; RLS enforces the same
 * rule in the database.
 */

export interface StoredPlan {
  /** YYYY-MM-DD the plan starts applying */
  effectiveFrom: string;
  goal: Goal;
  /** The chosen pace; null for a custom plan */
  kgPerWeek: number | null;
  /** null when maintaining */
  goalWeightKg: number | null;
  calorieTarget: number;
  proteinTarget: number;
  /** Snapshots of the numbers the plan was built from, so old plans still make sense */
  maintenanceKcal: number;
  weightKg: number;
}

interface PlanRow {
  effective_from: string;
  goal: Goal;
  kg_per_week: number | null;
  goal_weight_kg: number | null;
  calorie_target: number;
  protein_target: number;
  maintenance_kcal: number;
  weight_kg: number;
}

const PLAN_COLUMNS =
  "effective_from, goal, kg_per_week, goal_weight_kg, calorie_target, protein_target, maintenance_kcal, weight_kg";

/**
 * Whether the user has finished onboarding. Asks for one row instead of the
 * whole history, since this runs on every page load.
 */
export async function hasPlan(userId: string): Promise<boolean> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("plans")
    .select("effective_from")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check for a plan: ${error.message}`);
  return data !== null;
}

/** All of the user's plans, oldest first. */
export async function listPlans(userId: string, db?: Db): Promise<StoredPlan[]> {
  const client = db ?? (await createSessionClient());
  const { data, error } = await client
    .from("plans")
    .select(PLAN_COLUMNS)
    .eq("user_id", userId)
    .order("effective_from", { ascending: true });
  if (error) throw new Error(`Couldn't load plans: ${error.message}`);
  return (data as unknown as PlanRow[]).map((row) => ({
    effectiveFrom: row.effective_from,
    goal: row.goal,
    kgPerWeek: row.kg_per_week,
    goalWeightKg: row.goal_weight_kg,
    calorieTarget: row.calorie_target,
    proteinTarget: row.protein_target,
    maintenanceKcal: row.maintenance_kcal,
    weightKg: row.weight_kg,
  }));
}

/**
 * Adds a plan. The key is (user_id, effective_from), so picking a second plan
 * on the same day replaces that day's plan instead of stacking two.
 */
export async function savePlan(userId: string, plan: StoredPlan): Promise<void> {
  const row: PlanRow = {
    effective_from: plan.effectiveFrom,
    goal: plan.goal,
    kg_per_week: plan.kgPerWeek,
    goal_weight_kg: plan.goalWeightKg,
    calorie_target: plan.calorieTarget,
    protein_target: plan.proteinTarget,
    maintenance_kcal: plan.maintenanceKcal,
    weight_kg: plan.weightKg,
  };
  const db = await createSessionClient();
  const { error } = await db
    .from("plans")
    .upsert({ ...row, user_id: userId }, { onConflict: "user_id,effective_from" });
  if (error) throw new Error(`Couldn't save the plan: ${error.message}`);
}
