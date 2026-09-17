import { sumTotals } from "@/lib/scale";
import type { FoodItem, MealAnalysis } from "@/lib/schema";

/**
 * The Log's quick entry: a food typed in by hand, no photo and no AI. The
 * numbers are used exactly as typed, so there's no portion to scale.
 */

/** The form's raw text fields; carbs and fat may be left blank. */
export interface QuickEntryInput {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const MAX_NAME = 80;

/** A typed number, accepting a decimal comma; null when blank, NaN when not a number. */
function typed(value: string): number | null {
  const text = value.trim().replace(",", ".");
  return text === "" ? null : Number(text);
}

function amount(value: string, label: string, max: number, required: boolean): number | string {
  // "1,200" is a thousands separator, not 1.2 — ask for plain digits instead of guessing
  if (/^\s*\d{1,3},\d{3}\s*$/.test(value)) {
    return `Type the ${label} without a thousands separator, e.g. ${value.replace(",", "").trim()}.`;
  }
  const n = typed(value);
  if (n === null) return required ? `Enter the ${label}.` : 0;
  if (!Number.isFinite(n) || n < 0 || n > max) return `Enter ${label} between 0 and ${max}.`;
  return n;
}

/** The meal to log for a quick entry, or a message naming the first bad field. */
export function quickEntryAnalysis(input: QuickEntryInput): MealAnalysis | string {
  const name = input.name.trim();
  if (!name) return "Enter what you ate.";
  if (name.length > MAX_NAME) return `Keep the name to ${MAX_NAME} characters or fewer.`;
  const calories = amount(input.calories, "calories", 10000, true);
  if (typeof calories === "string") return calories;
  const protein = amount(input.protein, "protein", 1000, true);
  if (typeof protein === "string") return protein;
  const carbs = amount(input.carbs, "carbs", 1000, false);
  if (typeof carbs === "string") return carbs;
  const fat = amount(input.fat, "fat", 1000, false);
  if (typeof fat === "string") return fat;

  const food: FoodItem = {
    name,
    // No portion: the numbers are for the whole entry
    grams: 0,
    volume_ml: null,
    drink_type: null,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    confidence: "high",
    assumptions: "Entered by hand.",
    quickEntry: true,
  };
  return { foods: [food], totals: sumTotals([food]), notes: "" };
}
