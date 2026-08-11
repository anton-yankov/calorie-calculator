export type Confidence = "low" | "medium" | "high";

export interface FoodItem {
  name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  assumptions: string;
}

export interface MealTotals {
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
