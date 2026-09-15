import { createSessionClient } from "@/lib/supabase-session";

/** Daily targets, stored as one row per user in public.settings (see supabase/schema.sql). */
export interface Goals {
  calorieGoal: number;
  waterGoal: number | null;
  /** null = no protein target set */
  proteinGoal: number | null;
}

interface SettingsRow {
  calorie_goal: number;
  water_goal: number | null;
  protein_goal: number | null;
}

// Queries run as the logged-in user, so RLS already limits them to that
// user's row; the user_id filters say the same thing explicitly.

/** The user's goals, or null when they haven't set any yet. */
export async function getGoals(userId: string): Promise<Goals | null> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("settings")
    .select("calorie_goal, protein_goal, water_goal")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load goals: ${error.message}`);
  if (!data) return null;
  const row = data as SettingsRow;
  return {
    calorieGoal: row.calorie_goal,
    proteinGoal: row.protein_goal,
    waterGoal: row.water_goal,
  };
}

export async function saveGoals(goals: Goals, userId: string): Promise<void> {
  const db = await createSessionClient();
  // Upsert on the user_id primary key: creates the user's row the first time, updates it after
  const { error } = await db.from("settings").upsert({
    user_id: userId,
    calorie_goal: goals.calorieGoal,
    protein_goal: goals.proteinGoal,
    water_goal: goals.waterGoal,
  });
  if (error) throw new Error(`Couldn't save goals: ${error.message}`);
}
