import type { DrinkType } from "@/lib/water";
import type { FoodItem } from "@/lib/schema";
import type { BarcodeProduct, ProductNutrition } from "@/lib/products";
import { createSessionClient, type Db } from "@/lib/supabase-session";

/**
 * Server-side data layer for saved barcode products. Every product belongs to
 * one user: each function takes the logged-in user's id first, and a user can
 * save each barcode once (the primary key is user_id + barcode). RLS enforces
 * the same ownership rule in the database; the explicit user_id filters keep
 * each query scoped even if it's ever run with a client that bypasses RLS.
 */

interface BarcodeProductRow {
  portion_unit: "g" | "ml";
  drink_type: DrinkType | null;
  barcode: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  image_url: string | null;
  serving_grams: number | null;
  updated_at: string;
}

const PRODUCT_COLUMNS =
  "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, updated_at, image_url, serving_grams, portion_unit, drink_type";

/** Upserts match on the composite primary key, so one user's save never touches another's. */
const OWNER_KEY = "user_id,barcode";

function toProduct(row: BarcodeProductRow): BarcodeProduct {
  return {
    portionUnit: row.portion_unit,
    drinkType: row.drink_type,
    barcode: row.barcode,
    name: row.name,
    brand: "",
    imageUrl: row.image_url,
    servingGrams: row.serving_grams,
    per100g: {
      calories: row.calories_per_100g,
      protein_g: row.protein_per_100g,
      carbs_g: row.carbs_per_100g,
      fat_g: row.fat_per_100g,
    },
    source: "saved",
  };
}

export async function getSavedBarcodeProduct(
  userId: string,
  barcode: string,
): Promise<BarcodeProduct | null> {
  const db = await createSessionClient();
  const { data, error } = await db
    .from("barcode_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", userId)
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(`Couldn't look up the saved product: ${error.message}`);
  return data ? toProduct(data as unknown as BarcodeProductRow) : null;
}

export async function saveBarcodeProduct(
  userId: string,
  barcode: string,
  name: string,
  per100g: ProductNutrition,
  imageUrl: string | null,
  servingGrams: number | null,
  portionUnit: "g" | "ml" = "g",
  drinkType: DrinkType | null = null,
): Promise<BarcodeProduct> {
  const row: BarcodeProductRow = {
    barcode,
    name,
    portion_unit: portionUnit,
    drink_type: drinkType,
    calories_per_100g: per100g.calories,
    protein_per_100g: per100g.protein_g,
    carbs_per_100g: per100g.carbs_g,
    fat_per_100g: per100g.fat_g,
    image_url: imageUrl,
    serving_grams: servingGrams,
    updated_at: new Date().toISOString(),
  };
  const db = await createSessionClient();
  const { data, error } = await db
    .from("barcode_products")
    .upsert({ ...row, user_id: userId }, { onConflict: OWNER_KEY })
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) throw new Error(`Couldn't save the barcode product: ${error.message}`);
  return toProduct(data as unknown as BarcodeProductRow);
}

export async function listSavedBarcodeProducts(userId: string, db?: Db): Promise<BarcodeProduct[]> {
  const client = db ?? (await createSessionClient());
  const { data, error } = await client
    .from("barcode_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw new Error(`Couldn't load saved products: ${error.message}`);
  return (data as unknown as BarcodeProductRow[]).map(toProduct);
}

export async function deleteSavedBarcodeProduct(userId: string, barcode: string): Promise<void> {
  const db = await createSessionClient();
  const { error } = await db
    .from("barcode_products")
    .delete()
    .eq("user_id", userId)
    .eq("barcode", barcode);
  if (error) throw new Error(`Couldn't delete the product: ${error.message}`);
}

/** How much of a logged food was eaten, in its product's unit: the same amount portion edits scale. */
function loggedAmount(food: FoodItem): number | null {
  const amount = food.volume_ml ?? food.grams;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Each scanned barcode's logged amount; the last food wins when a barcode appears twice. */
function loggedAmounts(foods: readonly FoodItem[]): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const food of foods) {
    const amount = food.barcode ? loggedAmount(food) : null;
    if (food.barcode && amount !== null) amounts.set(food.barcode, amount);
  }
  return amounts;
}

/**
 * Makes each logged amount the one prefilled on the next scan. Only touches
 * products that are already saved, and only their amount: a deleted product
 * stays deleted and saved edits to nutrition, name or image are kept.
 */
export async function rememberLoggedAmounts(
  userId: string,
  foods: readonly FoodItem[],
): Promise<void> {
  const amounts = loggedAmounts(foods);
  if (amounts.size === 0) return;
  const db = await createSessionClient();
  const results = await Promise.all(
    [...amounts].map(([barcode, amount]) =>
      db
        .from("barcode_products")
        .update({ serving_grams: amount })
        .eq("user_id", userId)
        .eq("barcode", barcode),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Couldn't remember logged amounts: ${failed.error.message}`);
}

/**
 * Inserts new products, then remembers every logged amount. A later log never
 * overwrites a saved product's edits — only its amount for the next scan.
 */
export async function saveLoggedBarcodeProducts(
  userId: string,
  foods: readonly FoodItem[],
): Promise<void> {
  const amounts = loggedAmounts(foods);
  const rows = new Map<string, BarcodeProductRow>();
  for (const food of foods) {
    if (!food.barcode || !food.productSnapshot || rows.has(food.barcode)) continue;
    const product = food.productSnapshot;
    rows.set(food.barcode, {
      barcode: food.barcode,
      portion_unit: product.portionUnit ?? (food.drink_type ? "ml" : "g"),
      drink_type: product.drinkType !== undefined ? product.drinkType : (food.drink_type ?? null),
      name: product.name.trim(),
      calories_per_100g: product.per100g.calories,
      protein_per_100g: product.per100g.protein_g,
      carbs_per_100g: product.per100g.carbs_g,
      fat_per_100g: product.per100g.fat_g,
      image_url: food.imageUrl ?? null,
      serving_grams: amounts.get(food.barcode) ?? product.servingGrams,
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.size > 0) {
    const db = await createSessionClient();
    const { error } = await db.from("barcode_products").upsert(
      [...rows.values()].map((row) => ({ ...row, user_id: userId })),
      { onConflict: OWNER_KEY, ignoreDuplicates: true },
    );
    if (error) throw new Error(`Couldn't save logged products: ${error.message}`);
  }
  await rememberLoggedAmounts(userId, foods);
}
