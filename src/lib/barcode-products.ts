import type { BarcodeProduct, ProductNutrition } from "@/lib/products";
import { connection } from "next/server";
import { supabase } from "@/lib/supabase";

/** Server-side data layer for products saved after manual barcode entry. */

interface BarcodeProductRow {
  barcode: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  image_url?: string | null;
  serving_grams?: number | null;
  updated_at: string;
}

const BASE_COLUMNS =
  "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, updated_at";

/**
 * Column sets to try in order, newest first. Older Supabase projects may not
 * have the nullable columns added later (see supabase/schema.sql); reading
 * without them keeps scans working between deploying this code and running
 * the SQL.
 */
const COLUMN_SETS = [
  `${BASE_COLUMNS}, image_url, serving_grams`,
  `${BASE_COLUMNS}, image_url`,
  BASE_COLUMNS,
];

const OPTIONAL_COLUMNS = ["image_url", "serving_grams"];

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** Runs `query` with each column set until one the database knows succeeds. */
async function withColumnFallback<T>(
  query: (columns: string) => PromiseLike<QueryResult>,
  describe: string,
): Promise<T | null> {
  let lastError: string | null = null;
  for (const columns of COLUMN_SETS) {
    const { data, error } = await query(columns);
    if (!error) return data as T | null;
    lastError = error.message;
    const missingColumn = OPTIONAL_COLUMNS.some(
      (column) => columns.includes(column) && error.message.includes(column),
    );
    if (!missingColumn) break;
  }
  throw new Error(`${describe}: ${lastError}`);
}

function toProduct(row: BarcodeProductRow): BarcodeProduct {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: "",
    imageUrl: row.image_url ?? null,
    servingGrams: row.serving_grams ?? null,
    per100g: {
      calories: row.calories_per_100g,
      protein_g: row.protein_per_100g,
      carbs_g: row.carbs_per_100g,
      fat_g: row.fat_per_100g,
    },
    source: "saved",
  };
}

export async function getSavedBarcodeProduct(barcode: string): Promise<BarcodeProduct | null> {
  const row = await withColumnFallback<BarcodeProductRow>(
    (columns) =>
      supabase().from("barcode_products").select(columns).eq("barcode", barcode).maybeSingle(),
    "Couldn't look up the saved product",
  );
  return row ? toProduct(row) : null;
}

export async function saveBarcodeProduct(
  barcode: string,
  name: string,
  per100g: ProductNutrition,
  imageUrl: string | null,
  servingGrams: number | null,
): Promise<BarcodeProduct> {
  const row: BarcodeProductRow = {
    barcode,
    name,
    calories_per_100g: per100g.calories,
    protein_per_100g: per100g.protein_g,
    carbs_per_100g: per100g.carbs_g,
    fat_per_100g: per100g.fat_g,
    image_url: imageUrl,
    serving_grams: servingGrams,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase()
    .from("barcode_products")
    .upsert(row, { onConflict: "barcode" })
    .select(COLUMN_SETS[0])
    .single();
  if (error) throw new Error(`Couldn't save the barcode product: ${error.message}`);
  return toProduct(data as unknown as BarcodeProductRow);
}

export async function listSavedBarcodeProducts(): Promise<BarcodeProduct[]> {
  await connection();
  const rows = await withColumnFallback<BarcodeProductRow[]>(
    (columns) =>
      supabase().from("barcode_products").select(columns).order("name", { ascending: true }),
    "Couldn't load saved products",
  );
  return (rows ?? []).map(toProduct);
}

export async function deleteSavedBarcodeProduct(barcode: string): Promise<void> {
  const { error } = await supabase().from("barcode_products").delete().eq("barcode", barcode);
  if (error) throw new Error(`Couldn't delete the product: ${error.message}`);
}
