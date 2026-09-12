import type { FoodItem, MealTotals } from "@/lib/schema";

/**
 * Linear portion math shared by the Analyze page (live gram edits) and the
 * meal log (editing a saved entry). Always scale from an untouched baseline,
 * not the current values — setting grams to 0 would otherwise destroy the
 * per-gram ratios (0 × anything stays 0).
 */
export function scaleFood(base: FoodItem, grams: number): FoodItem {
  const amount = base.volume_ml ?? base.grams;
  if (amount <= 0) return base;
  const ratio = grams / amount;
  return {
    ...base,
    grams: base.grams * ratio,
    ...(base.volume_ml != null ? { volume_ml: grams } : {}),
    calories: base.calories * ratio,
    protein_g: base.protein_g * ratio,
    carbs_g: base.carbs_g * ratio,
    fat_g: base.fat_g * ratio,
  };
}

/** Sum nutrition and tracked drink volume, preserving unknown legacy water data. */
export function sumTotals(items: readonly (MealTotals | FoodItem)[]): MealTotals {
  const totals: MealTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const drinks = new Map<string, NonNullable<MealTotals["water_by_drink"]>[number]>();
  for (const item of items) {
    totals.calories += item.calories;
    totals.protein_g += item.protein_g;
    totals.carbs_g += item.carbs_g;
    totals.fat_g += item.fat_g;
    const food = "name" in item ? (item as FoodItem) : null;
    const nutritionLogged = food
      ? !food.drink_type ||
        food.calories > 0 ||
        food.protein_g > 0 ||
        food.carbs_g > 0 ||
        food.fat_g > 0
      : ((item as MealTotals).nutrition_logged ?? true);
    totals.nutrition_logged = (totals.nutrition_logged ?? false) || nutritionLogged;
    const tracked = food ? food.volume_ml !== undefined : "water_ml" in item;
    if (!tracked) continue;
    const ml = food ? (food.volume_ml ?? 0) : ((item as MealTotals).water_ml ?? 0);
    totals.water_ml = (totals.water_ml ?? 0) + ml;
    const sources = food
      ? food.drink_type && ml > 0
        ? [{ name: food.name, type: food.drink_type, ml }]
        : []
      : ((item as MealTotals).water_by_drink ?? []);
    for (const drink of sources) {
      const key = `${drink.type}:${drink.name.trim().toLowerCase()}`;
      const prev = drinks.get(key);
      drinks.set(key, { ...drink, ml: (prev?.ml ?? 0) + drink.ml });
    }
  }
  if (totals.water_ml !== undefined) totals.water_by_drink = [...drinks.values()];
  return totals;
}
