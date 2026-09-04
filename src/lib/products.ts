import type { FoodItem } from "@/lib/schema";

export interface ProductNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Food barcodes are 7–14 digits (EAN-8/UPC-E through GTIN-14). */
export const BARCODE_PATTERN = /^\d{7,14}$/;

/** Product images are small locally generated JPEG data URLs (see makeThumbnail). */
export const MAX_PRODUCT_IMAGE_LENGTH = 300_000;

/**
 * Validates a submitted product image: `null` clears it, a small JPEG data
 * URL keeps it, anything else is rejected (returns `undefined`).
 */
export function submittedProductImage(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value === "string" &&
    value.length <= MAX_PRODUCT_IMAGE_LENGTH &&
    /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(value)
  ) {
    return value;
  }
  return undefined;
}

/** Validates the four per-100 g values; every one must be a finite non-negative number. */
export function submittedNutrition(value: unknown): ProductNutrition | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Partial<Record<keyof ProductNutrition, unknown>>;
  const number = (field: unknown) =>
    typeof field === "number" && Number.isFinite(field) && field >= 0 ? field : null;
  const calories = number(input.calories);
  const protein = number(input.protein_g);
  const carbs = number(input.carbs_g);
  const fat = number(input.fat_g);
  if (calories === null || protein === null || carbs === null || fat === null) return null;
  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
}

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  servingGrams: number | null;
  per100g: ProductNutrition;
  source: "open-food-facts" | "saved";
}

function productName(product: Pick<BarcodeProduct, "brand" | "name">): string {
  if (!product.brand) return product.name;
  if (product.name.toLowerCase().includes(product.brand.toLowerCase())) return product.name;
  return `${product.brand} ${product.name}`;
}

export function barcodeProductToFood(product: BarcodeProduct, grams: number): FoodItem {
  const ratio = grams / 100;
  return {
    name: productName(product),
    grams,
    calories: product.per100g.calories * ratio,
    protein_g: product.per100g.protein_g * ratio,
    carbs_g: product.per100g.carbs_g * ratio,
    fat_g: product.per100g.fat_g * ratio,
    confidence: "high",
    assumptions:
      product.source === "saved"
        ? `Barcode ${product.barcode}; nutrition from a saved manual entry.`
        : `Barcode ${product.barcode}; nutrition per 100 g from Open Food Facts.`,
  };
}

export function manualProductToFood(
  name: string,
  grams: number,
  per100g: ProductNutrition,
  barcode?: string,
): FoodItem {
  const ratio = grams / 100;
  return {
    name: name.trim(),
    grams,
    calories: per100g.calories * ratio,
    protein_g: per100g.protein_g * ratio,
    carbs_g: per100g.carbs_g * ratio,
    fat_g: per100g.fat_g * ratio,
    confidence: "high",
    assumptions: barcode
      ? `Nutrition entered manually for barcode ${barcode}.`
      : "Nutrition entered manually per 100 g.",
  };
}
