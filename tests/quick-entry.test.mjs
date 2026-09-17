import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { quickEntryAnalysis } = loadModule("src/lib/quick-entry.ts");
const { scaleFood } = loadModule("src/lib/scale.ts");

const input = (fields) => ({
  name: "Banana",
  calories: "105",
  protein: "1.3",
  carbs: "",
  fat: "",
  ...fields,
});

test("a quick entry becomes one hand-typed food with matching totals", () => {
  const analysis = quickEntryAnalysis(input({ carbs: "27" }));
  assert.equal(analysis.foods.length, 1);
  const [food] = analysis.foods;
  assert.equal(food.name, "Banana");
  assert.equal(food.quickEntry, true);
  assert.equal(food.grams, 0);
  assert.deepEqual(
    [food.calories, food.protein_g, food.carbs_g, food.fat_g],
    [105, 1.3, 27, 0], // blank fat counts as 0
  );
  assert.equal(analysis.totals.calories, 105);
  assert.equal(analysis.totals.carbs_g, 27);
  assert.equal(analysis.totals.nutrition_logged, true);
});

test("names are trimmed and decimal commas are accepted", () => {
  const analysis = quickEntryAnalysis(input({ name: "  Yogurt ", protein: "17,5" }));
  assert.equal(analysis.foods[0].name, "Yogurt");
  assert.equal(analysis.foods[0].protein_g, 17.5);
});

test("missing or impossible numbers name the field", () => {
  assert.equal(quickEntryAnalysis(input({ name: " " })), "Enter what you ate.");
  assert.equal(quickEntryAnalysis(input({ calories: "" })), "Enter the calories.");
  assert.equal(quickEntryAnalysis(input({ protein: "" })), "Enter the protein.");
  assert.equal(
    quickEntryAnalysis(input({ calories: "abc" })),
    "Enter calories between 0 and 10000.",
  );
  assert.equal(quickEntryAnalysis(input({ fat: "-1" })), "Enter fat between 0 and 1000.");
  assert.match(quickEntryAnalysis(input({ name: "x".repeat(81) })), /80 characters or fewer/);
});

test("a thousands comma is refused rather than read as a decimal", () => {
  // The app shows "2,310 kcal"; typing "1,200" must not log 1.2 kcal
  assert.equal(
    quickEntryAnalysis(input({ calories: "1,200" })),
    "Type the calories without a thousands separator, e.g. 1200.",
  );
  assert.equal(quickEntryAnalysis(input({ calories: "1200" })).totals.calories, 1200);
  assert.equal(quickEntryAnalysis(input({ fat: "1,25" })).foods[0].fat_g, 1.25);
});

test("a hand-typed food never rescales", () => {
  const [food] = quickEntryAnalysis(input({})).foods;
  // grams is 0, so a portion edit leaves the typed numbers alone
  assert.equal(scaleFood(food, 200), food);
});

test("the server accepts the quick-entry marker only as true", async () => {
  const actions = loadModule("src/app/actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase-session": { getUserId: async () => "user-1" },
    "@/lib/profiles": {},
    "@/lib/meals": { insertMeals: async () => {} },
    "@/lib/barcode-products": { saveLoggedBarcodeProducts: async () => {} },
  });
  const analysis = quickEntryAnalysis(input({}));
  const meal = (food) => ({
    id: "m1",
    loggedAt: new Date().toISOString(),
    description: "",
    thumbnail: null,
    analysis: { ...analysis, foods: [food] },
  });
  assert.deepEqual(await actions.logMealAction(meal(analysis.foods[0])), {});
  assert.deepEqual(await actions.logMealAction(meal({ ...analysis.foods[0], quickEntry: "yes" })), {
    error: "Invalid meal data",
  });
});
