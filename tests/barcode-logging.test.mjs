import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const products = loadModule("src/lib/products.ts");
const { scaleFood } = loadModule("src/lib/scale.ts");
const product = {
  barcode: "1234567890123",
  name: "Yogurt",
  brand: "Example",
  imageUrl: null,
  servingGrams: 125.5,
  per100g: { calories: 80, protein_g: 5, carbs_g: 10, fat_g: 2 },
  source: "open-food-facts",
};
const food = products.barcodeProductToFood(product, 250);
const meal = {
  id: "test-meal",
  loggedAt: new Date().toISOString(),
  description: "Lunch",
  thumbnail: null,
  analysis: { foods: [food], totals: product.per100g, notes: "" },
};

function actions({ failMeal = false, failProducts = false, userId = "user-1" } = {}) {
  const events = [];
  const loaded = loadModule("src/app/actions.ts", {
    "next/cache": { revalidatePath: (path) => events.push(path) },
    "@/lib/supabase-session": { getUserId: async () => userId },
    "@/lib/products": products,
    "@/lib/settings": {},
    "@/lib/meals": {
      insertMeals: async () => {
        events.push("meal");
        if (failMeal) throw new Error("Meal failed");
      },
    },
    "@/lib/barcode-products": {
      saveLoggedBarcodeProducts: async (_userId, foods) => {
        events.push(foods);
        if (failProducts) throw new Error("Products failed");
      },
    },
  });
  return { ...loaded, events };
}

test("portion edits and AI corrections preserve original product nutrition and default grams", () => {
  const scaled = scaleFood(food, 30);
  assert.equal(scaled.calories, 24);
  assert.deepEqual(scaled.productSnapshot, {
    name: "Example Yogurt",
    per100g: product.per100g,
    servingGrams: 125.5,
  });
  const stripped = products.stripFoodExtras([scaled]);
  assert.equal(stripped[0].productSnapshot, undefined);
  const corrected = products.reattachFoodExtras([{ ...stripped[0], calories: 999 }], [scaled]);
  assert.deepEqual(corrected[0].productSnapshot, food.productSnapshot);
});

test("manual barcode entries carry nutrition until logging; plain foods have no product", () => {
  const manual = products.manualProductToFood("Manual", 75, product.per100g, product.barcode);
  assert.equal(manual.productSnapshot.servingGrams, 75);
  assert.equal(
    products.manualProductToFood("Plain", 75, product.per100g).productSnapshot,
    undefined,
  );
});

test("logging saves the meal before products and refreshes Products", async () => {
  const action = actions();
  assert.deepEqual(await action.logMealAction(meal), {});
  assert.deepEqual(action.events, ["meal", meal.analysis.foods, "/products", "/log", "/stats"]);
});

test("logged-out requests are rejected before any write", async () => {
  const action = actions({ userId: null });
  assert.deepEqual(await action.logMealAction(meal), { error: "Authentication required" });
  assert.deepEqual(action.events, []);
});

test("failed logging never saves products", async () => {
  const action = actions({ failMeal: true });
  assert.deepEqual(await action.logMealAction(meal), { error: "Meal failed" });
  assert.deepEqual(action.events, ["meal"]);
});

test("product save failure reports a warning rather than a failed meal", async () => {
  const action = actions({ failProducts: true });
  const result = await action.logMealAction(meal);
  assert.equal(result.error, undefined);
  assert.match(result.warning, /Meal logged/);
  assert.ok(action.events.includes("/log"));
});

test("invalid product snapshots are rejected before either write", async () => {
  for (const patch of [
    { name: "" },
    { per100g: { ...product.per100g, calories: -1 } },
    { servingGrams: 0 },
  ]) {
    const action = actions();
    const invalid = { ...food, productSnapshot: { ...food.productSnapshot, ...patch } };
    assert.deepEqual(
      await action.logMealAction({ ...meal, analysis: { ...meal.analysis, foods: [invalid] } }),
      { error: "Invalid meal data" },
    );
    assert.deepEqual(action.events, []);
  }
});

test("batch product saving deduplicates barcodes and never overwrites existing products", async () => {
  const calls = [];
  const data = loadModule("src/lib/barcode-products.ts", {
    "@/lib/supabase-session": {
      createSessionClient: async () => ({
        from: (table) => ({
          upsert: async (rows, options) => {
            calls.push({ table, rows, options });
            return { error: null };
          },
        }),
      }),
    },
  });
  await data.saveLoggedBarcodeProducts("user-1", [food, scaleFood(food, 10), { name: "Plain" }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "barcode_products");
  assert.equal(calls[0].rows.length, 1);
  assert.equal(calls[0].rows[0].user_id, "user-1");
  assert.equal(calls[0].rows[0].calories_per_100g, 80);
  assert.equal(calls[0].rows[0].serving_grams, 125.5);
  assert.deepEqual(calls[0].options, { onConflict: "user_id,barcode", ignoreDuplicates: true });
  await data.saveLoggedBarcodeProducts("user-1", [{ name: "Plain" }]);
  assert.equal(calls.length, 1);
});

test("saved barcode lookup returns saved macros and grams without calling the catalog", async () => {
  const saved = {
    ...product,
    source: "saved",
    servingGrams: 42,
    per100g: { ...product.per100g, calories: 90 },
  };
  const route = loadModule("src/app/api/products/[barcode]/route.ts", {
    "@/lib/products": products,
    "@/lib/supabase-session": { getUserId: async () => "user-1" },
    "@/lib/barcode-products": { getSavedBarcodeProduct: async () => saved },
  });
  const response = await route.GET(new Request("https://example.com"), {
    params: Promise.resolve({ barcode: product.barcode }),
  });
  assert.deepEqual(await response.json(), saved);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("catalog scanning returns nutrition without saving a product", async () => {
  let lookups = 0;
  const route = loadModule(
    "src/app/api/products/[barcode]/route.ts",
    {
      "@/lib/products": products,
      "@/lib/supabase-session": { getUserId: async () => "user-1" },
      "@/lib/barcode-products": {
        getSavedBarcodeProduct: async () => null,
        saveBarcodeProduct: async () => assert.fail("Scanning must not save products"),
      },
    },
    {
      fetch: async () => {
        lookups++;
        return Response.json({
          status: "success",
          product: {
            code: product.barcode,
            product_name: product.name,
            serving_quantity: 125.5,
            serving_quantity_unit: "g",
            nutriments: {
              "energy-kcal_100g": 80,
              proteins_100g: 5,
              carbohydrates_100g: 10,
              fat_100g: 2,
            },
          },
        });
      },
    },
  );
  const response = await route.GET(new Request("https://example.com"), {
    params: Promise.resolve({ barcode: product.barcode }),
  });
  const result = await response.json();
  assert.equal(lookups, 1);
  assert.equal(result.source, "open-food-facts");
  assert.deepEqual(result.per100g, product.per100g);
  assert.equal(result.servingGrams, 125.5);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
