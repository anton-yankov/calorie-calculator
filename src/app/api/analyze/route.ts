import { normalizeDrinkDescription, parseWater } from "@/lib/water";
import { sumTotals } from "@/lib/scale";
import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { MEAL_ANALYSIS_SCHEMA, type MealAnalysis } from "@/lib/schema";
import { claimAnalysis, OPENAI_OPTIONS, refundAnalysis } from "@/lib/ai-usage";
import { getUserId } from "@/lib/supabase-session";

export const runtime = "nodejs";
// Room for OPENAI_OPTIONS (two 40 s attempts) plus the refund afterwards
export const maxDuration = 90;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // client resizes to ~200KB; this is a hard backstop
// The cap counts requests, not their size, so the text sent along is bounded too
const MAX_TEXT_CHARS = 2_000;
const MAX_PREVIOUS_RESULT_CHARS = 64_000;

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
- Identify drinks automatically. Every consumed drink (including coffee, tea,
  milk, juice, soft drinks, alcohol, smoothies and shakes) counts at its FULL
  volume toward the water goal. Set volume_ml and drink_type for drinks.
- For foods, soups, sauces, oils, and liquid ingredients used in food, set
  volume_ml and drink_type to null. Do not count milk in porridge as a drink.
- Keep drink calories and macros, including additions such as sugar or milk.
  Represent a finished drink as ONE item with its final volume and nutrition;
  never double-count additions as separate drink volumes.
- Explicit ml/L units always win. Bare drink amounts > 0 and <= 5 mean litres;
  amounts >= 50 mean ml. Never silently guess units for values between 5 and 50.
  When no amount is given, estimate a typical serving and state it clearly.
- For photos, estimate consumed drink volume from the glass/package, mark
  uncertainty and state the assumed serving. Weight and volume are separate.
- Keep specific drink names (e.g. oat milk latte) and choose the matching category.
- totals must be the sums of the per-food values.`;

export async function POST(req: Request): Promise<Response> {
  // Checked here too, not only in the proxy: a proxy matcher change could
  // silently expose the OpenAI key behind this route
  const userId = await getUserId();
  if (!userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const form = await req.formData();
  const image = form.get("image");
  let description = form.get("description");
  const previousResult = form.get("previousResult");
  let correction = form.get("correction");

  const hasDescription = typeof description === "string" && description.trim().length > 0;
  const hasCorrection =
    typeof previousResult === "string" &&
    typeof correction === "string" &&
    correction.trim().length > 0;
  // Text-only and correction-only analysis are allowed — but there must be something to analyze
  if (!(image instanceof File) && !hasDescription && !hasCorrection) {
    return Response.json({ error: "Provide a photo or a description." }, { status: 400 });
  }
  if (
    (typeof description === "string" && description.length > MAX_TEXT_CHARS) ||
    (typeof correction === "string" && correction.length > MAX_TEXT_CHARS)
  ) {
    return Response.json(
      { error: `Keep the description under ${MAX_TEXT_CHARS} characters.` },
      { status: 400 },
    );
  }
  if (typeof previousResult === "string" && previousResult.length > MAX_PREVIOUS_RESULT_CHARS) {
    return Response.json({ error: "That estimate is too large to correct." }, { status: 400 });
  }
  if (image instanceof File && image.type && !image.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image file." }, { status: 415 });
  }

  if (!(image instanceof File) && !hasCorrection && typeof description === "string") {
    const water = parseWater(description);
    if (water) return Response.json(water, { status: "error" in water ? 400 : 200 });
  }
  if (typeof description === "string" && !hasCorrection) {
    const normalized = normalizeDrinkDescription(description);
    if ("error" in normalized) return Response.json(normalized, { status: 400 });
    description = normalized.description;
  }
  if (hasCorrection && typeof correction === "string") {
    const normalized = normalizeDrinkDescription(correction);
    if ("error" in normalized) return Response.json(normalized, { status: 400 });
    correction = normalized.description;
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
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
    userParts.push({ type: "input_text", text: `User description: ${String(description).trim()}` });
  }
  if (hasCorrection) {
    userParts.push({
      type: "input_text",
      text:
        `Previous analysis (JSON):\n${previousResult}\n\n` +
        `User correction: ${String(correction).trim()}`,
    });
  }

  // Water shorthand and bad input have returned by now, so they never use an analysis
  const refused = await claimAnalysis();
  if (refused) return refused;

  const client = new OpenAI(OPENAI_OPTIONS);
  // Only a request OpenAI never answered gives the analysis back: an answer is
  // paid for whether or not it turns out usable
  let answered = false;
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
    answered = true;
    const analysis: MealAnalysis = JSON.parse(response.output_text);
    analysis.totals = sumTotals(analysis.foods);
    return Response.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("analyze failed:", err);
    return Response.json({ error: `Analysis failed: ${message}` }, { status: 502 });
  } finally {
    if (!answered) await refundAnalysis(userId);
  }
}
