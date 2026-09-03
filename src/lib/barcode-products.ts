import type { BarcodeProduct, ProductNutrition } from "@/lib/products";
import { supabase } from "@/lib/supabase";

/** Server-side data layer for products saved after manual barcode entry. */

interface BarcodeProductRow {
  barcode: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

function toProduct(row: BarcodeProductRow): BarcodeProduct {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: "",
    imageUrl: null,
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
    .select("barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(`Couldn't look up the saved product: ${error.message}`);
  return data ? toProduct(data as BarcodeProductRow) : null;
}

export async function saveBarcodeProduct(
  barcode: string,
  name: string,
  per100g: ProductNutrition,
): Promise<BarcodeProduct> {
  const row: BarcodeProductRow = {
    barcode,
    name,
    calories_per_100g: per100g.calories,
    protein_per_100g: per100g.protein_g,
    carbs_per_100g: per100g.carbs_g,
    fat_per_100g: per100g.fat_g,
  };
  const { data, error } = await supabase()
    .from("barcode_products")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "barcode" })
    .select("barcode, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .single();
  if (error) throw new Error(`Couldn't save the barcode product: ${error.message}`);
  return toProduct(data as BarcodeProductRow);
}
