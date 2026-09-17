import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const water = loadModule("src/lib/water.ts");
const scale = loadModule("src/lib/scale.ts");
const products = loadModule("src/lib/products.ts");
const stats = loadModule("src/lib/stats.ts");
const macros = { calories: 60, protein_g: 3, carbs_g: 5, fat_g: 3 };
const milk = products.manualProductToFood("Milk", 250, macros, undefined, null, "ml", "milk");
const legacy = { name: "Lunch", grams: 200, ...macros, confidence: "high", assumptions: "" };
// One plan covering every day in these ranges
const plans = [
  {
    effectiveFrom: "2026-01-01",
    goal: "lose",
    kgPerWeek: 0.5,
    goalWeightKg: 78,
    calorieTarget: 2000,
    proteinTarget: 100,
    maintenanceKcal: 2550,
    weightKg: 85,
  },
];

test("water shorthand is deterministic, supports decimals/units and rejects ambiguous amounts", () => {
  for (const [text, ml] of [
    ["water 500", 500],
    ["Water 1", 1000],
    ["water 0.5", 500],
    ["water 1,5", 1500],
    ["water .5", 500],
    ["water 5", 5000],
    ["water 50", 50],
    ["water 20ml", 20],
    ["water 0.25 L", 250],
    ["water 1 litre", 1000],
  ]) {
    assert.equal(water.parseWater(text).totals.water_ml, ml, text);
    assert.equal(water.parseWater(text).totals.calories, 0);
  }
  for (const text of ["water 20", "water 6", "water 0", "water -1"])
    assert.ok(water.parseWater(text).error, text);
  assert.equal(water.parseWater("watermelon 500"), null);
  assert.equal(water.parseWater("water 500 and milk 250"), null);
});

test("mixed-meal drink shorthand expands without changing food quantities or explicit servings", () => {
  const result = water.normalizeDrinkDescription("2 eggs and milk 250, water 1");
  assert.match(result.description, /2 eggs/);
  assert.match(result.description, /milk 250 ml/);
  assert.match(result.description, /water 1000 ml/);
  assert.ok(water.normalizeDrinkDescription("sandwich and coffee 20").error);
  for (const text of ["coffee 2 cups", "milk 100 g", "milk 2%", "water 2 bottles"]) {
    assert.equal(water.normalizeDrinkDescription(text).description, text);
  }
});

test("drink calories/protein scale with volume, survive zero and classification corrections", () => {
  assert.equal(milk.volume_ml, 250);
  assert.equal(milk.grams, 0); // no invented density for a per-ml label
  assert.equal(milk.calories, 150);
  assert.equal(milk.protein_g, 7.5);
  assert.equal(scale.scaleFood(milk, 500).calories, 300);
  assert.equal(scale.scaleFood(milk, 500).volume_ml, 500);
  assert.equal(scale.scaleFood(milk, 0).volume_ml, 0);
  assert.equal(scale.scaleFood(milk, 250).protein_g, 7.5);
  const food = water.withDrinkType(milk, null);
  assert.equal(scale.sumTotals([food]).water_ml, 0);
  assert.equal(food.calories, 150);
  assert.equal(water.withDrinkType(food, "milk").volume_ml, 250);
});

test("food moisture is excluded and old water data stays unknown", () => {
  for (const name of [
    "Tomato soup",
    "Milk chocolate bar",
    "Coffee beans",
    "Protein powder",
    "Olive oil",
    "Milk powder",
    "Milk bread",
    "Yogurt",
  ])
    assert.equal(water.detectDrinkType(name), null, name);
  assert.equal(water.detectDrinkType("Oat milk latte"), "coffee");
  assert.equal(scale.sumTotals([legacy]).water_ml, undefined);
  const total = scale.sumTotals([legacy, milk, ...water.waterAnalysis(500).foods]);
  assert.equal(total.water_ml, 750);
  assert.equal(total.protein_g, 10.5);
  assert.equal(total.water_by_drink.length, 2);
});

test("drink breakdown is additive across entries and normalizes identical names", () => {
  const total = scale.sumTotals([
    scale.sumTotals([milk]),
    scale.sumTotals([{ ...milk, name: "MILK" }]),
    water.waterAnalysis(500).totals,
  ]);
  assert.equal(total.water_ml, 1000);
  assert.equal(total.water_by_drink.length, 2);
  assert.equal(total.water_by_drink.find((d) => d.type === "milk").ml, 500);
});

test("water stats exclude legacy days and today from averages, water-only days from nutrition", () => {
  const rows = [
    { loggedAt: "2026-09-07T12:00:00", totals: scale.sumTotals([legacy]) },
    { loggedAt: "2026-09-08T12:00:00", totals: scale.sumTotals([milk]) },
    {
      loggedAt: "2026-09-09T12:00:00",
      totals: water.waterAnalysis(2000).totals,
      nutritionLogged: false,
    },
    {
      loggedAt: "2026-09-10T12:00:00",
      totals: water.waterAnalysis(4000).totals,
      nutritionLogged: false,
    },
  ];
  const result = stats.computeRange(stats.groupByDay(rows), "7d", plans, 2000, "2026-09-10");
  assert.equal(result.summary.avgWater, 1125);
  assert.equal(result.summary.waterCompleteDays, 2);
  assert.equal(result.summary.waterGoalDays, 1);
  assert.equal(result.summary.completeDays, 2);
  assert.equal(result.summary.avgCalories, 105);
  assert.equal(
    result.waterByDrink.reduce((n, d) => n + d.ml, 0),
    6250,
  );
  assert.equal(result.buckets.find((b) => b.key === "2026-09-07").value.water_ml, undefined);
  const weekly = stats.computeRange(stats.groupByDay(rows), "90d", plans, 2000, "2026-09-10");
  const week = weekly.buckets.find((b) => b.key === "2026-09-07");
  assert.equal(week.value.water_ml, 1125);
  assert.equal(week.value.calories, 105);
});

test("water-only weeks have a water average and no calorie observations", () => {
  const rows = [
    {
      loggedAt: "2026-09-08T12:00:00",
      totals: water.waterAnalysis(1000).totals,
      nutritionLogged: false,
    },
  ];
  const range = stats.computeRange(stats.groupByDay(rows), "90d", plans, 2000, "2026-09-10");
  assert.equal(range.summary.avgCalories, null);
  assert.equal(range.summary.avgWater, 1000);
  assert.equal(range.buckets.find((b) => b.key === "2026-09-07").value.nutrition_logged, false);
});

test("plain water works without an AI key; ambiguous mixed input is rejected before AI", async () => {
  const route = loadModule("src/app/api/analyze/route.ts", {
    "@/lib/supabase-session": { getUserId: async () => "user-1" },
    openai: class {
      constructor() {
        assert.fail("Water must not call AI");
      }
    },
  });
  for (const [description, status] of [
    ["water 500", 200],
    ["water 1", 200],
    ["water 20", 400],
    ["sandwich and coffee 20", 400],
  ]) {
    const form = new FormData();
    form.set("description", description);
    const response = await route.POST(
      new Request("https://test/api/analyze", { method: "POST", body: form }),
    );
    assert.equal(response.status, status, description);
  }
});

test("server rejects invalid water fields and recomputes all totals before saving", async () => {
  const writes = [];
  const actions = loadModule("src/app/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase-session": { getUserId: async () => "user-1" },
    "@/lib/meals": {
      insertMeals: async (userId, meals) => writes.push(...meals.map((m) => ({ ...m, userId }))),
    },
    "@/lib/barcode-products": { saveLoggedBarcodeProducts: async () => {} },
    "@/lib/profiles": {},
  });
  const meal = {
    id: "water",
    loggedAt: new Date().toISOString(),
    description: "",
    thumbnail: null,
    analysis: { ...water.waterAnalysis(500), totals: { ...macros, water_ml: 999999 } },
  };
  for (const patch of [
    { volume_ml: -1 },
    { volume_ml: Infinity },
    { drink_type: "soup" },
    { volume_ml: null },
  ]) {
    const invalid = {
      ...meal,
      analysis: { ...meal.analysis, foods: [{ ...meal.analysis.foods[0], ...patch }] },
    };
    assert.ok((await actions.logMealAction(invalid)).error);
  }
  assert.equal(writes.length, 0);
  assert.deepEqual(await actions.logMealAction(meal), {});
  assert.equal(writes[0].userId, "user-1");
  assert.equal(writes[0].analysis.totals.water_ml, 500);
  assert.equal(writes[0].analysis.totals.calories, 0);
});

test("catalog drinks preserve ml basis, category and litre-sized packages", async () => {
  const route = loadModule(
    "src/app/api/products/[barcode]/route.ts",
    {
      "@/lib/supabase-session": { getUserId: async () => "user-1" },
      "@/lib/barcode-products": { getSavedBarcodeProduct: async () => null },
    },
    {
      fetch: async () =>
        Response.json({
          status: "success",
          product: {
            code: "12345678",
            product_name: "Whole milk",
            product_quantity: 1,
            product_quantity_unit: "l",
            categories_tags: ["en:beverages"],
            nutriments: {
              "energy-kcal_100g": 60,
              proteins_100g: 3,
              carbohydrates_100g: 5,
              fat_100g: 3,
            },
          },
        }),
    },
  );
  const response = await route.GET(new Request("https://test"), {
    params: Promise.resolve({ barcode: "12345678" }),
  });
  const product = await response.json();
  assert.equal(product.servingGrams, 1000);
  assert.equal(product.portionUnit, "ml");
  assert.equal(product.drinkType, "milk");
  const food = products.barcodeProductToFood(product, 250);
  assert.equal(food.volume_ml, 250);
  assert.equal(food.calories, 150);
  assert.equal(food.productSnapshot.portionUnit, "ml");
});
