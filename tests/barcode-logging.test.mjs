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
    "@/lib/profiles": {},
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

/** Loads the product data layer against a fake database that records every write. */
function productData() {
  const calls = [];
  const data = loadModule("src/lib/barcode-products.ts", {
    "@/lib/supabase-session": {
      createSessionClient: async () => ({
        from: (table) => ({
          upsert: async (rows, options) => {
            calls.push({ table, rows, options });
            return { error: null };
          },
          update: (values) => {
            const call = { table, update: values, filters: {} };
            calls.push(call);
            const query = {
              eq: (column, value) => {
                call.filters[column] = value;
                return query;
              },
              then: (resolve) => resolve({ error: null }),
            };
            return query;
          },
        }),
      }),
    },
  });
  return { data, calls };
}

test("batch product saving deduplicates barcodes and never overwrites existing products", async () => {
  const { data, calls } = productData();
  await data.saveLoggedBarcodeProducts("user-1", [food, scaleFood(food, 10), { name: "Plain" }]);
  const inserts = calls.filter((call) => call.rows);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, "barcode_products");
  assert.equal(inserts[0].rows.length, 1);
  assert.equal(inserts[0].rows[0].user_id, "user-1");
  assert.equal(inserts[0].rows[0].calories_per_100g, 80);
  assert.deepEqual(inserts[0].options, { onConflict: "user_id,barcode", ignoreDuplicates: true });
  await data.saveLoggedBarcodeProducts("user-1", [{ name: "Plain" }]);
  assert.equal(calls.length, 2);
});

test("logging remembers the last logged amount for the next scan", async () => {
  const { data, calls } = productData();
  await data.saveLoggedBarcodeProducts("user-1", [food, scaleFood(food, 10)]);
  // A new product starts from the logged amount, not the catalog serving
  assert.equal(calls[0].rows[0].serving_grams, 10);
  // An existing product only has its amount changed, for this user and barcode
  assert.deepEqual(calls[1], {
    table: "barcode_products",
    update: { serving_grams: 10 },
    filters: { user_id: "user-1", barcode: product.barcode },
  });
  assert.equal(calls.length, 2);
});

test("drinks logged in ml remember their volume", async () => {
  const { data, calls } = productData();
  const drink = products.barcodeProductToFood(
    { ...product, name: "Orange juice", portionUnit: "ml", drinkType: "juice" },
    330,
  );
  assert.equal(drink.grams, 0);
  await data.rememberLoggedAmounts("user-1", [drink]);
  assert.deepEqual(calls[0].update, { serving_grams: 330 });
});

test("logging again remembers amounts without re-adding deleted products", async () => {
  const events = [];
  const action = loadModule("src/app/actions.ts", {
    "next/cache": { revalidatePath: (path) => events.push(path) },
    "@/lib/supabase-session": { getUserId: async () => "user-1" },
    "@/lib/products": products,
    "@/lib/profiles": {},
    "@/lib/meals": {
      getMealById: async () => meal,
      insertMeals: async () => events.push("meal"),
    },
    "@/lib/barcode-products": {
      rememberLoggedAmounts: async (_userId, foods) => events.push(foods),
      saveLoggedBarcodeProducts: async () => assert.fail("Logging again must not add products"),
    },
  });
  assert.ok((await action.relogMealAction(meal.id)).newId);
  assert.deepEqual(events, ["meal", meal.analysis.foods, "/products", "/log", "/stats"]);
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
