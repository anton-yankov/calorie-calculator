import type { ActivityLevel, BodyDetails, Goal, Sex } from "@/lib/plan";

/**
 * Validation for anything the setup form and Settings both submit. Server
 * Actions can be called directly, so every number is re-checked here rather
 * than trusted from the browser. Each function returns the clean value, or a
 * message naming what's wrong.
 */

const SEXES: Sex[] = ["male", "female"];
const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "very", "extra"];
const GOALS: Goal[] = ["lose", "maintain", "gain"];

export const whole = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;

export const decimal = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;

/** A YYYY-MM-DD key no more than a day either side of the server's date. */
export function submittedToday(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const submitted = Date.parse(`${value}T12:00:00Z`);
  if (Number.isNaN(submitted)) return null;
  return Math.abs(submitted - Date.now()) <= 48 * 60 * 60 * 1000 ? value : null;
}

export interface BodyInput {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

/** Body details, or a message naming the first field that looks wrong. */
export function validBody(input: BodyInput): BodyDetails | string {
  const thisYear = new Date().getFullYear();
  const birthYear = whole(input.birthYear, thisYear - 100, thisYear - 14);
  if (!birthYear) return "Enter a birth year (you must be at least 14).";
  const heightCm = decimal(input.heightCm, 100, 250);
  if (!heightCm) return "Enter a height between 100 and 250 cm.";
  const weightKg = decimal(input.weightKg, 30, 300);
  if (!weightKg) return "Enter a weight between 30 and 300 kg.";
  if (!SEXES.includes(input.sex)) return "Choose male or female.";
  if (!ACTIVITY_LEVELS.includes(input.activityLevel)) return "Choose an activity level.";
  return { sex: input.sex, birthYear, heightCm, weightKg, activityLevel: input.activityLevel };
}

/** The goal weight for this goal: null when maintaining, or a message. */
export function validGoalWeight(
  goal: Goal,
  goalWeightKg: unknown,
  weightKg: number,
): number | null | string {
  if (!GOALS.includes(goal)) return "Choose a goal.";
  if (goal === "maintain") return null;
  const target = decimal(goalWeightKg, 30, 300);
  if (!target) return "Enter a goal weight between 30 and 300 kg.";
  if (goal === "lose" && target >= weightKg) {
    return "A goal weight for losing has to be below your current weight.";
  }
  if (goal === "gain" && target <= weightKg) {
    return "A goal weight for gaining has to be above your current weight.";
  }
  return target;
}

/** The calorie and protein targets of a custom plan, or a message. */
export function validCustomTargets(
  custom: { calorieTarget?: unknown; proteinTarget?: unknown } | null | undefined,
): { calorieTarget: number; proteinTarget: number } | string {
  const calorieTarget = whole(custom?.calorieTarget, 800, 8000);
  const proteinTarget = whole(custom?.proteinTarget, 20, 400);
  if (!calorieTarget || !proteinTarget) {
    return "Enter calories (800–8000) and protein (20–400 g).";
  }
  return { calorieTarget, proteinTarget };
}
