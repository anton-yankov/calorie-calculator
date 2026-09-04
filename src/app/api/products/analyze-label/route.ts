import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  NUTRITION_LABEL_SCHEMA,
  type NutritionLabelAnalysis,
} from "@/lib/nutrition-label";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const SYSTEM_PROMPT = `You accurately transcribe European food nutrition labels from photos.

Rules:
- Read the mandatory nutrition declaration per 100 g or per 100 ml. Treat the two bases as equivalent for this application, but report which one the label uses.
- Energy is commonly printed in both kJ and kcal. Return calories in kcal. Prefer the printed kcal value; only when kcal is absent, convert kJ to kcal by dividing by 4.184 and add a warning.
- European labels may use decimal commas. Interpret them as decimal points.
- Return total fat, total carbohydrate, and protein. Do not confuse saturates with fat, sugars with carbohydrate, or salt with protein.
- If values are only per serving and a serving mass or volume is clearly visible, calculate each value per 100 and set basis to calculated_per_100.
- Never guess or estimate an unreadable or missing value. Return null and explain it in warnings.
- Extract the product name only when clearly visible in the image. Otherwise return an empty string.
- Keep warnings short and factual.`;

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validAnalysis(value: unknown): value is NutritionLabelAnalysis {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<NutritionLabelAnalysis>;
  return (
    typeof result.productName === "string" &&
    isNullableNonNegativeNumber(result.calories) &&
    isNullableNonNegativeNumber(result.protein_g) &&
    isNullableNonNegativeNumber(result.carbs_g) &&
    isNullableNonNegativeNumber(result.fat_g) &&
    ["per_100_g", "per_100_ml", "calculated_per_100", "unknown"].includes(
      result.basis ?? "",
    ) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((warning) => typeof warning === "string")
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Nutrition scanning is not configured." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid image upload." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "Take or choose a nutrition-label photo." }, { status: 400 });
  }
  if (!image.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image file." }, { status: 415 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large (max 8 MB)." }, { status: 413 });
  }

  const b64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const userParts: ResponseInputContent[] = [
    {
      type: "input_image",
      detail: "high",
      image_url: `data:${image.type || "image/jpeg"};base64,${b64}`,
    },
    {
      type: "input_text",
      text: "Transcribe the nutrition table in this product-label photo.",
    },
  ];

  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.VISION_MODEL ?? "gpt-5.6-luna",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_label",
          schema: NUTRITION_LABEL_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      return Response.json({ error: "No nutrition values could be read." }, { status: 502 });
    }

    const analysis: unknown = JSON.parse(response.output_text);
    if (!validAnalysis(analysis)) {
      return Response.json({ error: "The nutrition values could not be validated." }, { status: 502 });
    }

    const foundValues = [
      analysis.calories,
      analysis.protein_g,
      analysis.carbs_g,
      analysis.fat_g,
    ].filter((value) => value !== null).length;
    if (foundValues === 0) {
      return Response.json(
        { error: "No nutrition table was readable. Retake the photo closer and in good light." },
        { status: 422 },
      );
    }

    return Response.json(analysis, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("nutrition label analysis failed:", error);
    return Response.json(
      { error: "Couldn't read the nutrition label. Retake the photo and try again." },
      { status: 502 },
    );
  }
}
