import type { DrinkType } from "@/lib/water";
import type { FoodItem } from "@/lib/schema";
import type { BarcodeProduct, ProductNutrition } from "@/lib/products";
import { connection } from "next/server";
import { createSessionClient } from "@/lib/supabase-session";

/**
 * Server-side data layer for saved barcode products. Every product belongs to
 * one user: each function takes the logged-in user's id first, and a user can
 * save each barcode once (the primary key is user_id + barcode). Queries run as
 * the logged-in user, so RLS already limits them to that user's rows; the
 * user_id filters say the same thing explicitly.
 */

interface BarcodeProductRow {
  user_id?: string;
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
    user_id: userId,
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
    .upsert(row, { onConflict: OWNER_KEY })
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) throw new Error(`Couldn't save the barcode product: ${error.message}`);
  return toProduct(data as unknown as BarcodeProductRow);
}

export async function listSavedBarcodeProducts(userId: string): Promise<BarcodeProduct[]> {
  await connection();
  const db = await createSessionClient();
  const { data, error } = await db
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

/** Insert new products only; a later scan must never overwrite saved edits or defaults. */
export async function saveLoggedBarcodeProducts(
  userId: string,
  foods: readonly FoodItem[],
): Promise<void> {
  const rows = new Map<string, BarcodeProductRow>();
  for (const food of foods) {
    if (!food.barcode || !food.productSnapshot || rows.has(food.barcode)) continue;
    const product = food.productSnapshot;
    rows.set(food.barcode, {
      user_id: userId,
      barcode: food.barcode,
      portion_unit: product.portionUnit ?? (food.drink_type ? "ml" : "g"),
      drink_type: product.drinkType !== undefined ? product.drinkType : (food.drink_type ?? null),
      name: product.name.trim(),
      calories_per_100g: product.per100g.calories,
      protein_per_100g: product.per100g.protein_g,
      carbs_per_100g: product.per100g.carbs_g,
      fat_per_100g: product.per100g.fat_g,
      image_url: food.imageUrl ?? null,
      serving_grams: product.servingGrams,
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.size === 0) return;
  const db = await createSessionClient();
  const { error } = await db
    .from("barcode_products")
    .upsert([...rows.values()], { onConflict: OWNER_KEY, ignoreDuplicates: true });
  if (error) throw new Error(`Couldn't save logged products: ${error.message}`);
}
