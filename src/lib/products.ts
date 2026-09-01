import type { FoodItem } from "@/lib/schema";

export interface ProductNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  servingGrams: number | null;
  per100g: ProductNutrition;
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
    assumptions: `Barcode ${product.barcode}; nutrition per 100 g from Open Food Facts.`,
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
