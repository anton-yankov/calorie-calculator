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
/** A meal's full-size photo (~800px JPEG data URL). */
export const MAX_MEAL_PHOTO_LENGTH = 400_000;
/** The image copied onto a scanned food (~320px JPEG data URL). */
export const MAX_FOOD_IMAGE_LENGTH = 100_000;

/** True for a JPEG data URL no longer than `maxLength`. */
export function isJpegDataUrl(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(value)
  );
}

/**
 * Validates a submitted product image: `null` clears it, a small JPEG data
 * URL keeps it, anything else is rejected (returns `undefined`).
 */
export function submittedProductImage(value: unknown): string | null | undefined {
  if (value === null) return null;
  return isJpegDataUrl(value, MAX_PRODUCT_IMAGE_LENGTH) ? value : undefined;
}

/**
 * Validates a submitted default amount: `null`/`undefined` means none, a
 * positive finite number keeps it, anything else is rejected (returns `undefined`).
 */
export function submittedServingGrams(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
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
  /**
   * The amount to prefill when this product is scanned: the catalog serving
   * (or package) size, or the amount entered when a product was saved manually.
   */
  servingGrams: number | null;
  per100g: ProductNutrition;
  source: "open-food-facts" | "saved";
}

function productName(product: Pick<BarcodeProduct, "brand" | "name">): string {
  if (!product.brand) return product.name;
  if (product.name.toLowerCase().includes(product.brand.toLowerCase())) return product.name;
  return `${product.brand} ${product.name}`;
}

/**
 * `imageUrl` is the copy that travels with the food into the meal — already
 * shrunk by the caller (see foodImageFrom), so it stays small in the log.
 */
export function barcodeProductToFood(
  product: BarcodeProduct,
  grams: number,
  imageUrl: string | null = null,
): FoodItem {
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
    barcode: product.barcode,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function manualProductToFood(
  name: string,
  grams: number,
  per100g: ProductNutrition,
  barcode?: string,
  imageUrl: string | null = null,
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
    ...(barcode ? { barcode } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

const norm = (name: string) => name.trim().toLowerCase();

/** The previous estimate without client-only fields, for sending back to the model. */
export function stripFoodExtras(foods: readonly FoodItem[]): FoodItem[] {
  return foods.map((food) => {
    const copy = { ...food };
    delete copy.barcode;
    delete copy.imageUrl;
    return copy;
  });
}

/**
 * After a correction the model returns fresh foods without barcode or image.
 * Re-attach them from the previous estimate, matching by barcode when the
 * name still contains it, otherwise by name. Each previous food is used once.
 */
export function reattachFoodExtras(
  foods: readonly FoodItem[],
  previous: readonly FoodItem[],
): FoodItem[] {
  const pool = previous.filter((f) => f.barcode || f.imageUrl);
  if (pool.length === 0) return [...foods];
  const remaining = [...pool];
  const take = (pick: (f: FoodItem) => boolean) => {
    const index = remaining.findIndex(pick);
    return index === -1 ? null : remaining.splice(index, 1)[0]!;
  };
  return foods.map((food) => {
    if (food.barcode || food.imageUrl) return food;
    const match =
      take((p) => !!p.barcode && food.assumptions.includes(p.barcode)) ??
      take((p) => norm(p.name) === norm(food.name));
    if (!match) return food;
    return {
      ...food,
      ...(match.barcode ? { barcode: match.barcode } : {}),
      ...(match.imageUrl ? { imageUrl: match.imageUrl } : {}),
    };
  });
}
