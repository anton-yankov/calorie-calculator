import type { MealAnalysis } from "@/lib/schema";

export interface LoggedMeal {
  id: string;
  /** ISO timestamp of when the meal was logged */
  loggedAt: string;
  /** The user's description text at log time, for context in the list */
  description: string;
  analysis: MealAnalysis;
  /** Small JPEG data URL (~160px) so entries are recognizable; null if unavailable */
  thumbnail: string | null;
}

/**
 * The log used to live in localStorage under this key; it now lives in
 * Supabase. These helpers remain so the log page can offer a one-time import
 * of meals still stored on this device (see ImportLocalMeals).
 */
const KEY = "calorie-log-v1";

export function readLocalMeals(): LoggedMeal[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "");
    return Array.isArray(parsed) ? (parsed as LoggedMeal[]) : [];
  } catch {
    return [];
  }
}

export function clearLocalMeals(): void {
  window.localStorage.removeItem(KEY);
}
