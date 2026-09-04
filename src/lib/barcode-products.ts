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
  updated_at: string;
}

function toProduct(row: BarcodeProductRow): BarcodeProduct {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: "",
    imageUrl: row.image_url ?? null,
    servingGrams: null,
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
  const { data, error } = await supabase()
    .from("barcode_products")
    .select(
      "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, updated_at",
    )
    .eq("barcode", barcode)
    .maybeSingle();
  if (error?.message.includes("image_url")) {
    // Keep scans working between deploying this code and running the nullable
    // column migration in an existing Supabase project.
    const legacy = await supabase()
      .from("barcode_products")
      .select(
        "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, updated_at",
      )
      .eq("barcode", barcode)
      .maybeSingle();
    if (legacy.error) {
      throw new Error(`Couldn't look up the saved product: ${legacy.error.message}`);
    }
    return legacy.data ? toProduct(legacy.data as BarcodeProductRow) : null;
  }
  if (error) throw new Error(`Couldn't look up the saved product: ${error.message}`);
  return data ? toProduct(data as BarcodeProductRow) : null;
}

export async function saveBarcodeProduct(
  barcode: string,
  name: string,
  per100g: ProductNutrition,
  imageUrl: string | null,
): Promise<BarcodeProduct> {
  const row: BarcodeProductRow = {
    barcode,
    name,
    calories_per_100g: per100g.calories,
    protein_per_100g: per100g.protein_g,
    carbs_per_100g: per100g.carbs_g,
    fat_per_100g: per100g.fat_g,
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase()
    .from("barcode_products")
    .upsert(row, { onConflict: "barcode" })
    .select(
      "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, updated_at",
    )
    .single();
  if (error) throw new Error(`Couldn't save the barcode product: ${error.message}`);
  return toProduct(data as BarcodeProductRow);
}

export async function listSavedBarcodeProducts(): Promise<BarcodeProduct[]> {
  await connection();
  const { data, error } = await supabase()
    .from("barcode_products")
    .select(
      "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error?.message.includes("image_url")) {
    const legacy = await supabase()
      .from("barcode_products")
      .select(
        "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (legacy.error) throw new Error(`Couldn't load saved products: ${legacy.error.message}`);
    return (legacy.data as BarcodeProductRow[]).map(toProduct);
  }
  if (error) throw new Error(`Couldn't load saved products: ${error.message}`);
  return (data as BarcodeProductRow[]).map(toProduct);
}

export async function updateSavedBarcodeProductImage(
  barcode: string,
  imageUrl: string | null,
): Promise<BarcodeProduct | null> {
  const { data, error } = await supabase()
    .from("barcode_products")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("barcode", barcode)
    .select(
      "barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url, updated_at",
    )
    .maybeSingle();
  if (error) throw new Error(`Couldn't update the product image: ${error.message}`);
  return data ? toProduct(data as BarcodeProductRow) : null;
}
