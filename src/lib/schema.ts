import { DRINK_TYPES, type DrinkType, type DrinkVolume } from "@/lib/water";
import type { ProductSnapshot } from "@/lib/products";

export type Confidence = "low" | "medium" | "high";

export interface FoodItem {
  name: string;
  grams: number;
  /** Absent on legacy entries; null for food, ml for drinks. */
  volume_ml?: number | null;
  drink_type?: DrinkType | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  assumptions: string;
  /** Barcode this food was scanned from; absent for photo or text foods */
  barcode?: string;
  /** Original product data, kept separate from editable meal portions and estimates. */
  productSnapshot?: ProductSnapshot;
  /** Small JPEG data URL copied from the product at add time; absent if none */
  imageUrl?: string;
  /** Typed in on the Log's quick entry: numbers as given, grams is 0 and never scaled */
  quickEntry?: true;
}

export interface MealTotals {
  nutrition_logged?: boolean;
  /** Absent means water was not tracked, not zero. */
  water_ml?: number;
  water_by_drink?: DrinkVolume[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealAnalysis {
  foods: FoodItem[];
  totals: MealTotals;
  notes: string;
}

const macroProps = {
  calories: { type: "number", description: "Estimated kilocalories for this portion" },
  protein_g: { type: "number", description: "Grams of protein" },
  carbs_g: { type: "number", description: "Grams of carbohydrates" },
  fat_g: { type: "number", description: "Grams of fat" },
} as const;

// Strict structured-outputs schema: every object needs additionalProperties: false
// and all properties listed in `required`.
export const MEAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      description: "One entry per distinct food item visible in the photo",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short human-readable food name" },
          grams: { type: "number", description: "Estimated portion weight in grams" },
          volume_ml: {
            type: ["number", "null"],
            description:
              "Full consumed drink volume in ml; null for solid food, soups, sauces and ingredients used in food",
          },
          drink_type: {
            type: ["string", "null"],
            enum: [...DRINK_TYPES, null],
            description: "Drink category; null for food",
          },
          ...macroProps,
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "How confident the identification and portion estimate are",
          },
          assumptions: {
            type: "string",
            description: "Key assumptions behind the estimate, one short sentence",
          },
        },
        required: [
          "name",
          "grams",
          "volume_ml",
          "drink_type",
          "calories",
          "protein_g",
          "carbs_g",
          "fat_g",
          "confidence",
          "assumptions",
        ],
        additionalProperties: false,
      },
    },
    totals: {
      type: "object",
      description: "Sums across all foods",
      properties: { ...macroProps },
      required: ["calories", "protein_g", "carbs_g", "fat_g"],
      additionalProperties: false,
    },
    notes: {
      type: "string",
      description: "Overall caveats, e.g. what was used as a size reference",
    },
  },
  required: ["foods", "totals", "notes"],
  additionalProperties: false,
} as const;
