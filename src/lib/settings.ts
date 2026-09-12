import { supabase } from "@/lib/supabase";

/** Daily targets, stored as a single row in public.settings (see supabase/schema.sql). */
export interface Goals {
  calorieGoal: number;
  waterGoal: number | null;
  /** null = no protein target set */
  proteinGoal: number | null;
}

interface SettingsRow {
  calorie_goal: number;
  water_goal?: number | null;
  protein_goal: number | null;
}

export async function getGoals(): Promise<Goals | null> {
  let { data, error } = await supabase()
    .from("settings")
    .select("calorie_goal, protein_goal, water_goal")
    .maybeSingle();
  if (error?.message.includes("water_goal")) {
    ({ data, error } = await supabase()
      .from("settings")
      .select("calorie_goal, protein_goal")
      .maybeSingle());
  }
  if (error) {
    // The table may not exist yet (schema.sql not run) — treat as "no goals set"
    // so the log still renders instead of failing the whole page.
    console.warn("getGoals failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as SettingsRow;
  return {
    calorieGoal: row.calorie_goal,
    proteinGoal: row.protein_goal,
    waterGoal: row.water_goal ?? null,
  };
}

export async function saveGoals(goals: Goals): Promise<void> {
  const { error } = await supabase()
    .from("settings")
    .upsert({
      id: true,
      calorie_goal: goals.calorieGoal,
      protein_goal: goals.proteinGoal,
      water_goal: goals.waterGoal,
    });
  if (error?.message.includes("water_goal"))
    throw new Error(
      "Water goals need the database update. Run the water-goal SQL in Supabase first.",
    );
  if (error) throw new Error(`Couldn't save goals: ${error.message}`);
}
