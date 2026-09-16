import type { ActivityLevel, BodyDetails, Sex } from "@/lib/plan";
import { createSessionClient, type Db } from "@/lib/supabase-session";

/**
 * Server-side data layer for public.profiles: one row per user with the body
 * details behind the maintenance estimate, plus the water setting. Every
 * function takes the logged-in user's id first and filters by it; RLS enforces
 * the same rule in the database.
 */

export interface Profile extends BodyDetails {
  waterTracking: boolean;
  /** Daily water goal in ml; null when none is set */
  waterGoalMl: number | null;
}

/** The columns the maintenance estimate needs — what onboarding and profile edits write. */
interface BodyRow {
  sex: Sex;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
}

interface ProfileRow extends BodyRow {
  water_tracking: boolean;
  water_goal_ml: number | null;
}

const PROFILE_COLUMNS =
  "sex, birth_year, height_cm, weight_kg, activity_level, water_tracking, water_goal_ml";

/** The user's profile, or null before onboarding. */
export async function getProfile(userId: string, db?: Db): Promise<Profile | null> {
  const client = db ?? (await createSessionClient());
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the profile: ${error.message}`);
  if (!data) return null;
  const row = data as ProfileRow;
  return {
    sex: row.sex,
    birthYear: row.birth_year,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level,
    waterTracking: row.water_tracking,
    waterGoalMl: row.water_goal_ml,
  };
}

/**
 * Creates the profile on onboarding and overwrites the body details on later
 * edits (upsert on user_id). Only the columns below are sent, so the water
 * setting keeps its value.
 */
export async function saveProfile(userId: string, profile: BodyDetails): Promise<void> {
  const row: BodyRow = {
    sex: profile.sex,
    birth_year: profile.birthYear,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    activity_level: profile.activityLevel,
  };
  const db = await createSessionClient();
  const { error } = await db.from("profiles").upsert({ ...row, user_id: userId });
  if (error) throw new Error(`Couldn't save the profile: ${error.message}`);
}

/**
 * Turns water tracking on or off and stores its goal. An update rather than an
 * upsert: the profile always exists by the time Settings can be reached.
 */
export async function saveWaterSetting(
  userId: string,
  waterTracking: boolean,
  waterGoalMl: number | null,
): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db
    .from("profiles")
    .update({ water_tracking: waterTracking, water_goal_ml: waterGoalMl })
    .eq("user_id", userId);
  if (error) throw new Error(`Couldn't save the water setting: ${error.message}`);
}

/** The water goal days are judged against: null whenever water tracking is off. */
export function activeWaterGoal(profile: Profile | null): number | null {
  return profile?.waterTracking ? profile.waterGoalMl : null;
}
