"use server";

import { revalidatePath } from "next/cache";
import { savePlan } from "@/lib/plan-history";
import { maintenanceCalories, suggestPlans, type Goal } from "@/lib/plan";
import {
  submittedToday,
  validBody,
  validCustomTargets,
  validGoalWeight,
  whole,
  type BodyInput,
} from "@/lib/profile-input";
import { getProfile, saveProfile, saveWaterSetting } from "@/lib/profiles";
import { createSessionClient, getUserId } from "@/lib/supabase-session";

const failed = (err: unknown, fallback: string) => ({
  error: err instanceof Error ? err.message : fallback,
});

/**
 * Stores new body details. Targets are deliberately left alone: they only
 * change when the user picks a new plan, so a corrected weight never silently
 * rewrites today's numbers.
 */
export async function saveDetailsAction(input: BodyInput): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };
  const body = validBody(input);
  if (typeof body === "string") return { error: body };
  try {
    await saveProfile(userId, body);
  } catch (err) {
    return failed(err, "Couldn't save your details");
  }
  revalidatePath("/settings");
  return {};
}

/** Turns water tracking on or off, with its goal in ml. */
export async function saveWaterAction(input: {
  tracking: boolean;
  goalMl: number | null;
}): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };
  if (typeof input?.tracking !== "boolean") return { error: "Invalid water setting" };
  const goalMl = input.goalMl === null ? null : whole(input.goalMl, 100, 10000);
  if (input.tracking && !goalMl) return { error: "Enter a water goal between 100 and 10000 ml." };
  try {
    await saveWaterSetting(userId, input.tracking, goalMl);
  } catch (err) {
    return failed(err, "Couldn't save the water setting");
  }
  // The water bar appears or disappears on the Log, Stats and Analyze pages
  revalidatePath("/", "layout");
  return {};
}

interface PlanChangeInput {
  goal: Goal;
  /** null when maintaining */
  goalWeightKg: number | null;
  /** The chosen pace in kg per week; null for custom targets */
  kgPerWeek: number | null;
  custom: { calorieTarget: number; proteinTarget: number } | null;
  /** The user's own YYYY-MM-DD today */
  today: string;
}

/**
 * Adds a plan starting today. Body details come from the stored profile, not
 * from the browser, and the targets are recomputed here — the same rule as
 * setup. Earlier days keep the plan they were logged under.
 */
export async function changePlanAction(input: PlanChangeInput): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };

  const today = submittedToday(input?.today);
  if (!today) return { error: "Invalid date" };

  const profile = await getProfile(userId);
  if (!profile) return { error: "Add your details before changing your plan." };
  const body = validBody(profile);
  if (typeof body === "string") return { error: body };

  const goalWeightKg = validGoalWeight(input.goal, input.goalWeightKg, body.weightKg);
  if (typeof goalWeightKg === "string") return { error: goalWeightKg };

  const maintenanceKcal = maintenanceCalories(body, Number(today.slice(0, 4)));
  let calorieTarget: number;
  let proteinTarget: number;

  if (input.kgPerWeek === null) {
    const custom = validCustomTargets(input.custom);
    if (typeof custom === "string") return { error: custom };
    ({ calorieTarget, proteinTarget } = custom);
  } else {
    const suggested = suggestPlans(body, input.goal, goalWeightKg, today).find(
      (plan) => plan.kgPerWeek === input.kgPerWeek,
    );
    if (!suggested) return { error: "Choose one of the suggested plans." };
    calorieTarget = suggested.calorieTarget;
    proteinTarget = suggested.proteinTarget;
  }

  try {
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
    return failed(err, "Couldn't save the plan");
  }
  revalidatePath("/", "layout");
  return {};
}

/**
 * Changes the password after checking the current one. Supabase doesn't ask for
 * the old password itself, so signing in with it is how we prove the person at
 * the keyboard is the account owner and not someone holding an unlocked phone.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string; ok?: true }> {
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { error: "Use at least 8 characters for the new password." };
  }
  const supabase = await createSessionClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (userError || !email) return { error: "Authentication required" };

  const check = await supabase.auth.signInWithPassword({
    email,
    password: String(currentPassword),
  });
  if (check.error) return { error: "That current password isn’t right." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return {
      error: error.code === "same_password" ? "That's already your password." : error.message,
    };
  }
  return { ok: true };
}
