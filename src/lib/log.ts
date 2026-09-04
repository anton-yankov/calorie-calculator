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
  /** Larger display copy, loaded only when the image viewer opens */
  photo: string | null;
}

/** Log-list payload deliberately excludes the larger photo. */
export type LoggedMealSummary = Omit<LoggedMeal, "photo">;

/** Keeps Server Action payloads below Next.js's 1 MB default body limit. */
export const MAX_MEAL_PHOTO_LENGTH = 700_000;
