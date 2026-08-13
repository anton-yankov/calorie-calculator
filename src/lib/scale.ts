import type { FoodItem, MealTotals } from "@/lib/schema";

/**
 * Linear portion math shared by the Analyze page (live gram edits) and the
 * meal log (editing a saved entry). Always scale from an untouched baseline,
 * not the current values — setting grams to 0 would otherwise destroy the
 * per-gram ratios (0 × anything stays 0).
 */
export function scaleFood(base: FoodItem, grams: number): FoodItem {
  if (base.grams <= 0) return { ...base, grams };
  const ratio = grams / base.grams;
  return {
    ...base,
    grams,
    calories: base.calories * ratio,
    protein_g: base.protein_g * ratio,
    carbs_g: base.carbs_g * ratio,
    fat_g: base.fat_g * ratio,
  };
}

/** Sum calorie/macro totals; accepts foods or per-meal totals alike. */
export function sumTotals(items: readonly MealTotals[]): MealTotals {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein_g: acc.protein_g + item.protein_g,
      carbs_g: acc.carbs_g + item.carbs_g,
      fat_g: acc.fat_g + item.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}
