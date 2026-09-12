import type { FoodItem, MealAnalysis } from "@/lib/schema";

export const DRINK_TYPES = [
  "water",
  "coffee",
  "tea",
  "milk",
  "juice",
  "soft_drink",
  "smoothie",
  "shake",
  "alcohol",
  "other",
] as const;
export type DrinkType = (typeof DRINK_TYPES)[number];
export const DRINK_LABELS: Record<DrinkType, string> = {
  water: "Water",
  coffee: "Coffee",
  tea: "Tea",
  milk: "Milk",
  juice: "Juice",
  soft_drink: "Soft drinks",
  smoothie: "Smoothies",
  shake: "Shakes",
  alcohol: "Alcohol",
  other: "Other drinks",
};
export interface DrinkVolume {
  name: string;
  type: DrinkType;
  ml: number;
}
export function isDrinkType(value: unknown): value is DrinkType {
  return DRINK_TYPES.includes(value as DrinkType);
}
export function formatWater(ml: number): string {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${Math.round(ml)} ml`;
}
export function foodAmount(food: FoodItem): number {
  return food.volume_ml ?? food.grams;
}
export function foodUnit(food: FoodItem): "g" | "ml" {
  return food.volume_ml != null ? "ml" : "g";
}

/** Conservative name fallback for products; analysis handles free-form meals. */
export function detectDrinkType(name: string): DrinkType | null {
  const text = name.toLowerCase().replace(/[_-]/g, " ");
  if (
    /\b(soup|sauce|oil|powder|beans|grounds|syrup|chocolate bar|ice cream|yogurt|yoghurt|cheese|butter|bread|biscuit|cookie|cake|condensed|evaporated)\b/.test(
      text,
    )
  )
    return null;
  if (/\b(smoothie)\b/.test(text)) return "smoothie";
  if (/\b(shake|milkshake)\b/.test(text)) return "shake";
  if (/\b(coffee|espresso|cappuccino|latte|americano|mocha)\b/.test(text)) return "coffee";
  if (/\b(tea|matcha|chai|kombucha)\b/.test(text)) return "tea";
  if (/\b(milk|oat drink|almond drink|soy drink|kefir|ayran)\b/.test(text)) return "milk";
  if (/\b(juice|nectar)\b/.test(text)) return "juice";
  if (/\b(cola|soda|lemonade|sprite|fanta|pepsi|energy drink|sports drink|red bull)\b/.test(text))
    return "soft_drink";
  if (/\b(beer|wine|cider|vodka|whisky|whiskey|rum|gin|cocktail)\b/.test(text)) return "alcohol";
  if (/\bwater\b/.test(text)) return "water";
  return null;
}

/** Stable shorthand: (0, 5] = litres, [50, infinity) = ml. The gap needs units. */
export function parseDrinkAmount(raw: string, unit?: string): { ml: number } | { error: string } {
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter a positive drink amount." };
  if (unit) return { ml: value * (/^(l|lit(er|re)s?)$/i.test(unit) ? 1000 : 1) };
  if (value <= 5) return { ml: value * 1000 };
  if (value >= 50) return { ml: value };
  return { error: `Add units to ${raw}: for example ${raw} ml or ${raw} L.` };
}

export function waterAnalysis(ml: number): MealAnalysis {
  const food: FoodItem = {
    name: "Water",
    grams: ml,
    volume_ml: ml,
    drink_type: "water",
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    confidence: "high",
    assumptions: `${formatWater(ml)} of plain water.`,
  };
  return {
    foods: [food],
    totals: {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      nutrition_logged: false,
      water_ml: ml,
      water_by_drink: [{ name: "Water", type: "water", ml }],
    },
    notes: "",
  };
}

export function parseWater(text: string): MealAnalysis | { error: string } | null {
  const match = text
    .trim()
    .match(
      /^(?:plain\s+)?water\s+([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)?$/i,
    );
  if (!match) return null;
  const amount = parseDrinkAmount(match[1]!, match[2]);
  return "error" in amount ? amount : waterAnalysis(amount.ml);
}

/** Expand only recognizable drink shorthand, including drinks inside mixed meals. */
export function normalizeDrinkDescription(
  text: string,
): { description: string } | { error: string } {
  let error: string | undefined;
  const description = text.replace(
    /\b(water|coffee|espresso|cappuccino|latte|americano|mocha|tea|matcha|chai|milk|kefir|ayran|juice|smoothie|shake|milkshake|cola|soda|lemonade|beer|wine|cider|vodka|whisky|whiskey|rum|gin|cocktail)\s+([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))(?!\d|[.,]\d)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)?(?!\w)/gi,
    (whole, name: string, raw: string, unit: string | undefined, offset: number) => {
      // Counts and explicit weight/serving units are left for the analyzer.
      if (
        !unit &&
        /^\s*(g\b|grams?\b|kg\b|cups?\b|glasses?\b|bottles?\b|cans?\b|shots?\b|oz\b|%)/i.test(
          text.slice(offset + whole.length),
        )
      )
        return whole;
      const result = parseDrinkAmount(raw, unit);
      if ("error" in result) {
        error = result.error;
        return whole;
      }
      return `${name} ${result.ml} ml `;
    },
  );
  return error ? { error } : { description: description.trim() };
}

/** Classification correction preserves nutrition; the initial volume is an editable estimate. */
export function withDrinkType(food: FoodItem, type: DrinkType | null): FoodItem {
  return {
    ...food,
    grams: food.grams || food.volume_ml || 0,
    volume_ml: type ? foodAmount(food) : null,
    drink_type: type,
    assumptions:
      type && food.volume_ml == null
        ? "Drink volume estimated from the portion; check the ml amount."
        : food.assumptions,
  };
}
