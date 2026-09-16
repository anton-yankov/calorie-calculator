"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { savePlan } from "@/lib/plan-history";
import { maintenanceCalories, suggestPlans, type Goal } from "@/lib/plan";
import {
  submittedToday,
  validBody,
  validCustomTargets,
  validGoalWeight,
  type BodyInput,
} from "@/lib/profile-input";
import { saveProfile } from "@/lib/profiles";
import { getUserId } from "@/lib/supabase-session";

/**
 * What the setup form submits. The chosen plan arrives as a pace or as custom
 * targets; either way the calorie and protein numbers are recomputed here, so a
 * crafted request can't store targets that don't match the body details.
 */
interface OnboardingInput extends BodyInput {
  goal: Goal;
  /** null when maintaining */
  goalWeightKg: number | null;
  /** The chosen pace in kg per week; null for custom targets */
  kgPerWeek: number | null;
  /** Used only when kgPerWeek is null */
  custom: { calorieTarget: number; proteinTarget: number } | null;
  /** The user's own YYYY-MM-DD today — only the browser knows their timezone */
  today: string;
}

/**
 * Saves the profile and the first plan, then opens the app. The plan starts
 * today, so every day from here on is judged by it (earlier days fall back to
 * the oldest plan).
 */
export async function saveOnboardingAction(input: OnboardingInput): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };
  if (typeof input !== "object" || input === null) return { error: "Invalid setup data" };

  const today = submittedToday(input.today);
  if (!today) return { error: "Invalid date" };

  const body = validBody(input);
  if (typeof body === "string") return { error: body };

  const goalWeightKg = validGoalWeight(input.goal, input.goalWeightKg, body.weightKg);
  if (typeof goalWeightKg === "string") return { error: goalWeightKg };

  const maintenanceKcal = maintenanceCalories(body, Number(today.slice(0, 4)));
  let calorieTarget: number;
  let proteinTarget: number;

  if (input.kgPerWeek === null) {
    // Custom targets: the user's own numbers, within believable bounds. A target
    // that can't reach the goal weight is allowed — the form says so, and it's
    // still their choice.
    const custom = validCustomTargets(input.custom);
    if (typeof custom === "string") return { error: custom };
    ({ calorieTarget, proteinTarget } = custom);
  } else {
    // A suggested plan: take the targets from the pace, never from the client
    const suggested = suggestPlans(body, input.goal, goalWeightKg, today).find(
      (plan) => plan.kgPerWeek === input.kgPerWeek,
    );
    if (!suggested) return { error: "Choose one of the suggested plans." };
    calorieTarget = suggested.calorieTarget;
    proteinTarget = suggested.proteinTarget;
  }

  try {
    await saveProfile(userId, body);
    await savePlan(userId, {
      effectiveFrom: today,
      goal: input.goal,
      kgPerWeek: input.kgPerWeek,
      goalWeightKg,
      calorieTarget,
      proteinTarget,
      maintenanceKcal,
      weightKg: body.weightKg,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save your plan" };
  }

  // The gate above every tracker page now answers differently for this user
  revalidatePath("/", "layout");
  redirect("/");
}
