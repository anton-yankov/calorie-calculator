import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { searchProducts, RECENT_COUNT } = loadModule("src/lib/product-search.ts");

const product = (name, barcode, lastLoggedAt = null) => ({
  barcode,
  name,
  brand: "",
  imageUrl: null,
  servingGrams: 30,
  per100g: { calories: 440, protein_g: 7, carbs_g: 70, fat_g: 14 },
  source: "saved",
  lastLoggedAt,
});

// A to Z, as the database returns them
const products = [
  product("Fresh milk 3.6%", "3800000000001", "2026-10-04T08:00:00Z"),
  product("Greek yogurt", "3800000000002"),
  product("Milk biscuits", "3800000000003", "2026-10-06T07:00:00Z"),
  product("Milk chocolate", "3800000000004"),
];
const names = (list) => list.map((p) => p.name);

test("with nothing typed, recently logged lead newest first and the rest stay A to Z", () => {
  const { recent, rest } = searchProducts(products, "  ");
  assert.deepEqual(names(recent), ["Milk biscuits", "Fresh milk 3.6%"]);
  assert.deepEqual(names(rest), ["Greek yogurt", "Milk chocolate"]);
});

test("only the last few logged count as recent; older ones fall back into the A to Z list", () => {
  const many = Array.from({ length: RECENT_COUNT + 2 }, (_, i) =>
    product(`Product ${i}`, `380000000010${i}`, `2026-10-0${i + 1}T08:00:00Z`),
  );
  const { recent, rest } = searchProducts(many, "");
  assert.equal(recent.length, RECENT_COUNT);
  assert.equal(recent[0].name, `Product ${RECENT_COUNT + 1}`);
  assert.deepEqual(names(rest), ["Product 0", "Product 1"]);
});

test("searching matches name (any case) or barcode, recently logged matches first", () => {
  const { recent, rest } = searchProducts(products, "MILK");
  assert.deepEqual(recent, []);
  assert.deepEqual(names(rest), ["Milk biscuits", "Fresh milk 3.6%", "Milk chocolate"]);
  assert.deepEqual(names(searchProducts(products, "0002").rest), ["Greek yogurt"]);
  assert.deepEqual(searchProducts(products, "oat").rest, []);
});

test("the product list route returns the viewer's products and nothing when logged out", async () => {
  const route = (userId, list) =>
    loadModule("src/app/api/products/route.ts", {
      "@/lib/supabase-session": { getUserId: async () => userId },
      "@/lib/barcode-products": {
        listSavedBarcodeProducts: async (owner) => {
          assert.equal(owner, "user-1");
          if (list instanceof Error) throw list;
          return list;
        },
      },
    });
  const ok = await route("user-1", products).GET();
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await ok.json(), products);
  assert.equal((await route(null, products).GET()).status, 401);
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await route("user-1", new Error("down")).GET()).status, 500);
  } finally {
    console.error = originalError;
  }
});
