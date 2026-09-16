"use server";

import { revalidatePath } from "next/cache";
import { submittedPastDay, validWeighIn } from "@/lib/profile-input";
import { getUserId } from "@/lib/supabase-session";
import { deleteWeight, saveWeight } from "@/lib/weights";

const failed = (err: unknown, fallback: string) => ({
  error: err instanceof Error ? err.message : fallback,
});

// Settings pre-fills its weight field from the latest weigh-in
const refresh = () => {
  revalidatePath("/stats");
  revalidatePath("/settings");
};

/** Logs a weigh-in; a day that already has one gets replaced. Never touches the plan. */
export async function saveWeightAction(input: {
  day: string;
  weightKg: number;
}): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };
  const day = submittedPastDay(input?.day);
  if (!day) return { error: "Choose a day that isn't in the future." };
  const weightKg = validWeighIn(input.weightKg);
  if (typeof weightKg === "string") return { error: weightKg };
  try {
    await saveWeight(userId, { day, weightKg });
  } catch (err) {
    return failed(err, "Couldn't save the weigh-in");
  }
  refresh();
  return {};
}

export async function deleteWeightAction(day: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Authentication required" };
  const valid = submittedPastDay(day);
  if (!valid) return { error: "Invalid day" };
  try {
    await deleteWeight(userId, valid);
  } catch (err) {
    return failed(err, "Couldn't delete the weigh-in");
  }
  refresh();
  return {};
}
