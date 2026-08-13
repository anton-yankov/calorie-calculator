import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { MEAL_ANALYSIS_SCHEMA, type MealAnalysis } from "@/lib/schema";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // client resizes to ~200KB; this is a hard backstop

const SYSTEM_PROMPT = `You are a nutrition estimation assistant.
Given a photo of food, a text description, or both, identify each
distinct food item and estimate: portion weight in grams, calories, and
grams of protein, carbs, and fat.

Rules:
- Use visual cues (plate size, utensils, packaging, hands) to judge portions.
- When no photo is provided, estimate from the description alone using
  typical serving sizes, and mark confidence accordingly.
- The user's description overrides what you infer from the image
  (e.g. if they say "whole milk", do not assume skim).
- If a correction to a previous answer is provided, produce a fully
  corrected new answer: apply the correction and keep everything else
  that was right.
- Include foods that are partially hidden or implied (cooking oil on
  fried items, dressing on salads) with low confidence rather than
  omitting them.
- State your key assumptions per item; mark confidence "low" when the
  photo is ambiguous.
- totals must be the sums of the per-food values.`;

export async function POST(req: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const image = form.get("image");
  const description = form.get("description");
  const previousResult = form.get("previousResult");
  const correction = form.get("correction");

  const hasDescription = typeof description === "string" && description.trim().length > 0;
  // Text-only analysis is allowed — but there must be something to analyze
  if (!(image instanceof File) && !hasDescription) {
    return Response.json({ error: "Provide a photo or a description." }, { status: 400 });
  }

  const userParts: ResponseInputContent[] = [];
  if (image instanceof File) {
    if (image.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image too large (max 8 MB)." }, { status: 413 });
    }
    const mimeType = image.type || "image/jpeg";
    const b64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    userParts.push({
      type: "input_image",
      detail: "auto",
      image_url: `data:${mimeType};base64,${b64}`,
    });
  }
  if (hasDescription) {
    userParts.push({ type: "input_text", text: `User description: ${description.trim()}` });
  }
  if (typeof previousResult === "string" && typeof correction === "string" && correction.trim()) {
    userParts.push({
      type: "input_text",
      text:
        `Previous analysis (JSON):\n${previousResult}\n\n` +
        `User correction: ${correction.trim()}`,
    });
  }

  const client = new OpenAI();
  try {
    const response = await client.responses.create({
      model: process.env.VISION_MODEL ?? "gpt-5.6-luna",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_analysis",
          schema: MEAL_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      return Response.json({ error: "Model returned no output." }, { status: 502 });
    }
    const analysis: MealAnalysis = JSON.parse(response.output_text);
    return Response.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("analyze failed:", err);
    return Response.json({ error: `Analysis failed: ${message}` }, { status: 502 });
  }
}
