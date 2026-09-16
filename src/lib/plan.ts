import { addDays } from "@/lib/day";

/**
 * Calorie maths for plans: pure functions with no database or UI, so every
 * number the app suggests can be tested and explained on its own.
 */

export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "extra";

/** How much more than resting a day of this activity burns (BMR × factor). */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

/** What the maintenance estimate needs; stored per user as the profile. */
export interface BodyDetails {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

/**
 * Basal metabolic rate: calories burned at complete rest, by the
 * Mifflin-St Jeor equation. Age comes from the birth year, so it can be off by
 * up to a year (about 5 kcal).
 */
export function bmr(body: BodyDetails, currentYear: number): number {
  const age = currentYear - body.birthYear;
  const sexOffset = body.sex === "male" ? 5 : -161;
  return 10 * body.weightKg + 6.25 * body.heightCm - 5 * age + sexOffset;
}

/** Maintenance calories (TDEE): what keeps the weight steady, rounded to whole kcal. */
export function maintenanceCalories(body: BodyDetails, currentYear: number): number {
  return Math.round(bmr(body, currentYear) * ACTIVITY_FACTORS[body.activityLevel]);
}

export type Goal = "lose" | "maintain" | "gain";

/**
 * Energy in a kilogram of body weight change. The common rule of thumb: good
 * enough for an estimated date, though it overstates long-term loss.
 */
const KCAL_PER_KG = 7700;

const PROTEIN_G_PER_KG = 2.0;

/** The YYYY-MM-DD date `weeks` after `today`, rounded to whole days. */
function goalDateAfter(today: string, weeks: number): string {
  return addDays(today, Math.round(weeks * 7));
}

/**
 * The weekly weight change a calorie target implies against a maintenance
 * figure: negative when eating below it. Used to describe a stored custom plan,
 * which has no pace of its own.
 */
export function paceFromCalories(calorieTarget: number, maintenanceKcal: number): number {
  return ((calorieTarget - maintenanceKcal) * 7) / KCAL_PER_KG;
}

interface PaceOption {
  name: string;
  kgPerWeek: number;
  recommended: boolean;
}

/** The plans offered for each goal, by weekly weight change; one per goal is recommended. */
const PACE_OPTIONS: Record<Goal, PaceOption[]> = {
  lose: [
    { name: "Gentle", kgPerWeek: 0.25, recommended: false },
    { name: "Steady", kgPerWeek: 0.5, recommended: true },
    { name: "Faster", kgPerWeek: 0.75, recommended: false },
  ],
  maintain: [{ name: "Maintain", kgPerWeek: 0, recommended: true }],
  gain: [
    { name: "Lean", kgPerWeek: 0.25, recommended: true },
    { name: "Steady", kgPerWeek: 0.5, recommended: false },
  ],
};

interface SuggestedPlan extends PaceOption {
  calorieTarget: number;
  proteinTarget: number;
  /** Weeks until the goal weight at this pace; null when maintaining */
  weeksToGoal: number | null;
  /** YYYY-MM-DD the goal weight is reached at this pace; null when maintaining */
  goalDate: string | null;
}

/**
 * The plans to offer for a goal. `today` is a YYYY-MM-DD key (it also supplies
 * the year for the age). Inputs are trusted, e.g. a "lose" goal weight above
 * the current weight isn't caught here: the onboarding action validates them.
 */
export function suggestPlans(
  body: BodyDetails,
  goal: Goal,
  goalWeightKg: number | null,
  today: string,
): SuggestedPlan[] {
  const maintenance = maintenanceCalories(body, Number(today.slice(0, 4)));
  const proteinTarget = Math.round(body.weightKg * PROTEIN_G_PER_KG);
  // Losing eats below maintenance, gaining above; maintaining has a 0 kg pace
  const direction = goal === "lose" ? -1 : 1;

  return PACE_OPTIONS[goal].map((option) => {
    const dailyChange = (option.kgPerWeek * KCAL_PER_KG) / 7;
    const weeksToGoal =
      goal === "maintain" || goalWeightKg === null
        ? null
        : Math.abs(goalWeightKg - body.weightKg) / option.kgPerWeek;
    return {
      ...option,
      calorieTarget: Math.round(maintenance + direction * dailyChange),
      proteinTarget,
      weeksToGoal,
      goalDate: weeksToGoal === null ? null : goalDateAfter(today, weeksToGoal),
    };
  });
}

/** What your own calorie target leads to, for the "Set my own" panel. */
type CustomPlanOutlook =
  /** Maintaining has no goal weight: only the expected weekly change (negative = losing) */
  | { kind: "maintain"; weeklyChangeKg: number }
  | { kind: "reachable"; kgPerWeek: number; weeksToGoal: number; goalDate: string }
  /** The calories move weight away from the goal, or don't move it at all */
  | { kind: "impossible" };

/**
 * The outlook for your own daily calories. Protein doesn't change the weight
 * estimate, so only calories are needed. Like suggestPlans, inputs are trusted
 * and validated by the onboarding action.
 */
export function customPlanOutlook(
  body: BodyDetails,
  goal: Goal,
  goalWeightKg: number | null,
  calorieTarget: number,
  today: string,
): CustomPlanOutlook {
  const maintenance = maintenanceCalories(body, Number(today.slice(0, 4)));
  // Positive when eating above maintenance (gaining), negative below (losing)
  const weeklyChangeKg = ((calorieTarget - maintenance) * 7) / KCAL_PER_KG;
  if (goal === "maintain" || goalWeightKg === null) return { kind: "maintain", weeklyChangeKg };

  const movesTowardGoal = goal === "lose" ? weeklyChangeKg < 0 : weeklyChangeKg > 0;
  if (!movesTowardGoal) return { kind: "impossible" };

  const kgPerWeek = Math.abs(weeklyChangeKg);
  const weeksToGoal = Math.abs(goalWeightKg - body.weightKg) / kgPerWeek;
  return { kind: "reachable", kgPerWeek, weeksToGoal, goalDate: goalDateAfter(today, weeksToGoal) };
}
