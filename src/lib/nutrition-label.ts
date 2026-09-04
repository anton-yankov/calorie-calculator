export type NutritionLabelBasis =
  | "per_100_g"
  | "per_100_ml"
  | "calculated_per_100"
  | "unknown";

export interface NutritionLabelAnalysis {
  productName: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  basis: NutritionLabelBasis;
  warnings: string[];
}

const nullableNumber = { type: ["number", "null"] } as const;

export const NUTRITION_LABEL_SCHEMA = {
  type: "object",
  properties: {
    productName: {
      type: "string",
      description: "Product name only when it is clearly visible; otherwise an empty string",
    },
    calories: {
      ...nullableNumber,
      description: "Kilocalories per 100 g or 100 ml, or null when unreadable",
    },
    protein_g: {
      ...nullableNumber,
      description: "Protein grams per 100 g or 100 ml, or null when unreadable",
    },
    carbs_g: {
      ...nullableNumber,
      description: "Carbohydrate grams per 100 g or 100 ml, or null when unreadable",
    },
    fat_g: {
      ...nullableNumber,
      description: "Fat grams per 100 g or 100 ml, or null when unreadable",
    },
    basis: {
      type: "string",
      enum: ["per_100_g", "per_100_ml", "calculated_per_100", "unknown"],
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Short warnings about unreadable, missing, or converted values",
    },
  },
  required: [
    "productName",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "basis",
    "warnings",
  ],
  additionalProperties: false,
} as const;
