import { createSessionClient, type Db } from "@/lib/supabase-session";

/**
 * Server-side data layer for public.weight_entries: at most one weigh-in per
 * user per day. Every function takes the logged-in user's id first and filters
 * by it; RLS enforces the same rule in the database.
 */

export interface WeightEntry {
  /** YYYY-MM-DD in the user's timezone */
  day: string;
  weightKg: number;
}

interface WeightRow {
  day: string;
  weight_kg: number;
}

/** All of the user's weigh-ins, oldest first. */
export async function listWeights(userId: string, db?: Db): Promise<WeightEntry[]> {
  const client = db ?? (await createSessionClient());
  const { data, error } = await client
    .from("weight_entries")
    .select("day, weight_kg")
    .eq("user_id", userId)
    .order("day", { ascending: true });
  if (error) throw new Error(`Couldn't load weigh-ins: ${error.message}`);
  return (data as WeightRow[]).map((row) => ({ day: row.day, weightKg: row.weight_kg }));
}

/** The day of the user's most recent weigh-in, or null if there are none. */
export async function latestWeighInDay(userId: string): Promise<string | null> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("weight_entries")
    .select("day")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the latest weigh-in: ${error.message}`);
  return (data as { day: string } | null)?.day ?? null;
}

/**
 * Stores a weigh-in. The key is (user_id, day), so logging a day that already
 * has one replaces it instead of adding a second.
 */
export async function saveWeight(userId: string, entry: WeightEntry): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db
    .from("weight_entries")
    .upsert(
      { user_id: userId, day: entry.day, weight_kg: entry.weightKg },
      { onConflict: "user_id,day" },
    );
  if (error) throw new Error(`Couldn't save the weigh-in: ${error.message}`);
}

export async function deleteWeight(userId: string, day: string): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db.from("weight_entries").delete().eq("user_id", userId).eq("day", day);
  if (error) throw new Error(`Couldn't delete the weigh-in: ${error.message}`);
}
