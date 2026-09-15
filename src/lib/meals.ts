import { connection } from "next/server";
import type { LoggedMeal } from "@/lib/log";
import { sumTotals } from "@/lib/scale";
import type { MealAnalysis, MealTotals } from "@/lib/schema";
import { createSessionClient } from "@/lib/supabase-session";

/**
 * Server-side data layer for the meal log — the only code that touches the table.
 * Queries run as the logged-in user, so the database's RLS policy limits every
 * read, update and delete to that user's own meals; no query here filters by
 * user itself.
 */

interface MealRow {
  id: string;
  logged_at: string;
  description: string;
  analysis: MealAnalysis;
  thumbnail: string | null;
  /** Absent from list rows, which never select the large photo */
  photo?: string | null;
}

/** Every column except the large photo — what the log list loads per meal. */
const LIST_COLUMNS = "id, logged_at, description, analysis, thumbnail";

function toMeal(row: MealRow): LoggedMeal {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    description: row.description,
    analysis: row.analysis,
    thumbnail: row.thumbnail,
    ...(row.photo !== undefined ? { photo: row.photo } : {}),
  };
}

function toRow(meal: LoggedMeal): MealRow {
  return {
    id: meal.id,
    logged_at: meal.loggedAt,
    description: meal.description,
    analysis: meal.analysis,
    thumbnail: meal.thumbnail,
    photo: meal.photo ?? null,
  };
}

/** A meal reduced to when it was eaten and its totals — all the stats page needs. */
export interface MealTotalRow {
  loggedAt: string;
  totals: MealTotals;
  /** Zero-calorie drink-only entries must not create fake meal days. */
  nutritionLogged?: boolean;
}

/**
 * Every meal's timestamp and totals, oldest first — no thumbnails, no food
 * lists, so a year of meals is ~100 KB. Days are grouped on the client (only
 * the viewer knows their timezone), so this stays a plain row scan.
 */
export async function listMealTotals(): Promise<MealTotalRow[]> {
  await connection();
  const db = await createSessionClient();
  const { data, error } = await db
    .from("meals")
    .select("logged_at, totals:analysis->totals")
    .order("logged_at", { ascending: true });
  if (error) throw new Error(`Couldn't load stats: ${error.message}`);
  return (data as unknown as { logged_at: string; totals: MealTotals | null }[])
    .filter((row) => row.totals !== null)
    .map((row) => ({
      loggedAt: row.logged_at,
      totals: row.totals as MealTotals,
      nutritionLogged: (row.totals as MealTotals).nutrition_logged ?? true,
    }));
}

export async function listMeals(): Promise<LoggedMeal[]> {
  // The log must never be prerendered at build time — always fetch per request
  await connection();
  const db = await createSessionClient();
  const { data, error } = await db
    .from("meals")
    .select(LIST_COLUMNS)
    .order("logged_at", { ascending: false });
  if (error) throw new Error(`Couldn't load the meal log: ${error.message}`);
  return (data as unknown as MealRow[]).map(toMeal);
}

/** The large photo for one meal, or null if it has none (or doesn't exist). */
export async function getMealPhotoById(id: string): Promise<string | null> {
  const db = await createSessionClient();
  const { data, error } = await db.from("meals").select("photo").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the photo: ${error.message}`);
  return (data as { photo: string | null } | null)?.photo ?? null;
}

export async function getMealById(id: string): Promise<LoggedMeal | null> {
  const db = await createSessionClient();
  const { data, error } = await db.from("meals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the meal: ${error.message}`);
  return data ? toMeal(data as MealRow) : null;
}

/** Saves meals owned by `userId` — the logged-in user, never a value sent by the client. */
export async function insertMeals(meals: LoggedMeal[], userId: string): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db
    .from("meals")
    .insert(meals.map((meal) => ({ ...toRow(meal), user_id: userId })));
  if (error) throw new Error(`Couldn't save: ${error.message}`);
}

export async function updateMealById(
  id: string,
  patch: { analysis: MealAnalysis; loggedAt: string },
): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db
    .from("meals")
    .update({ analysis: patch.analysis, logged_at: patch.loggedAt })
    .eq("id", id);
  if (error) throw new Error(`Couldn't update: ${error.message}`);
}

/** Deletes the meal and returns the full row (photo included) so Undo can re-insert it. */
export async function deleteMealById(id: string): Promise<LoggedMeal | null> {
  const db = await createSessionClient();
  const { data, error } = await db.from("meals").delete().eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(`Couldn't delete: ${error.message}`);
  return data ? toMeal(data as MealRow) : null;
}

/** Latest logged_at in [startIso, endIso), or null if none — used to order backdated meals. */
export async function latestLoggedAtBetween(
  startIso: string,
  endIso: string,
): Promise<string | null> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("meals")
    .select("logged_at")
    .gte("logged_at", startIso)
    .lt("logged_at", endIso)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check the day's meals: ${error.message}`);
  return data ? (data as { logged_at: string }).logged_at : null;
}

/** Calorie/macro sums for meals logged in [startIso, endIso) — used for "today so far". */
export async function sumTotalsBetween(startIso: string, endIso: string): Promise<MealTotals> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("meals")
    .select("analysis")
    .gte("logged_at", startIso)
    .lt("logged_at", endIso);
  if (error) throw new Error(`Couldn't load today's totals: ${error.message}`);
  const totals = sumTotals(
    (data as { analysis: MealAnalysis }[]).map((row) => row.analysis.totals),
  );
  return data.length === 0 ? { ...totals, water_ml: 0, water_by_drink: [] } : totals;
}
