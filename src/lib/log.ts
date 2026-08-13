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
