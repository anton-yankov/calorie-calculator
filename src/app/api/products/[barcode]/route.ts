import { getSavedBarcodeProduct, saveBarcodeProduct } from "@/lib/barcode-products";
import type { BarcodeProduct, ProductNutrition } from "@/lib/products";

export const runtime = "nodejs";

const BARCODE_PATTERN = /^\d{7,14}$/;
const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "image_front_small_url",
  "nutriments",
  "serving_quantity",
].join(",");

interface OpenFoodFactsProduct {
  code?: unknown;
  product_name?: unknown;
  product_name_en?: unknown;
  brands?: unknown;
  image_front_small_url?: unknown;
  serving_quantity?: unknown;
  nutriments?: Record<string, unknown>;
}

interface OpenFoodFactsResponse {
  status?: unknown;
  product?: OpenFoodFactsProduct;
}

interface SaveProductBody {
  name?: unknown;
  per100g?: Partial<Record<keyof ProductNutrition, unknown>>;
}

function submittedNutritionValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nutrition(product: OpenFoodFactsProduct): ProductNutrition | null {
  const nutriments = product.nutriments ?? {};
  let calories = finite(nutriments["energy-kcal_100g"]);
  if (calories === null) {
    const kilojoules = finite(nutriments["energy-kj_100g"] ?? nutriments.energy_100g);
    calories = kilojoules === null ? null : kilojoules / 4.184;
  }

  const protein = finite(nutriments.proteins_100g);
  const carbs = finite(nutriments.carbohydrates_100g);
  const fat = finite(nutriments.fat_100g);
  if (calories === null || protein === null || carbs === null || fat === null) return null;

  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
}

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode } = await context.params;
  if (!BARCODE_PATTERN.test(barcode)) {
    return Response.json({ error: "Enter a 7–14 digit food barcode." }, { status: 400 });
  }

  try {
    const saved = await getSavedBarcodeProduct(barcode);
    if (saved) {
      return Response.json(saved, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch (error) {
    // A temporary database problem should not prevent the public catalog lookup.
    console.error("saved product lookup failed:", error);
  }

  const url = new URL(
    `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json`,
  );
  url.searchParams.set("fields", PRODUCT_FIELDS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          process.env.OPEN_FOOD_FACTS_USER_AGENT ??
          "CalorieCalculator/0.1 (https://github.com/Tonkata-hub/calorie-calculator)",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error("product lookup failed:", error);
    return Response.json(
      { error: "Product lookup is unavailable. Try again shortly." },
      { status: 502 },
    );
  }

  if (response.status === 404) {
    return Response.json(
      { error: "Product not found. You can enter its nutrition manually." },
      { status: 404 },
    );
  }

  if (!response.ok) {
    return Response.json(
      { error: "Product lookup is unavailable. Try again shortly." },
      { status: 502 },
    );
  }

  const body = (await response.json()) as OpenFoodFactsResponse;
  const source = body.product;
  if (body.status !== "success" || !source) {
    return Response.json(
      { error: "Product not found. You can enter its nutrition manually." },
      { status: 404 },
    );
  }

  const name = text(source.product_name) || text(source.product_name_en);
  const per100g = nutrition(source);
  if (!name || !per100g) {
    return Response.json(
      {
        error: "This product is missing a name or complete nutrition. Enter it manually.",
        product: { name, brand: text(source.brands) },
      },
      { status: 422 },
    );
  }

  const serving = finite(source.serving_quantity);
  const product: BarcodeProduct = {
    barcode: text(source.code) || barcode,
    name,
    brand: text(source.brands),
    imageUrl: text(source.image_front_small_url) || null,
    servingGrams: serving !== null && serving > 0 ? serving : null,
    per100g,
    source: "open-food-facts",
  };

  return Response.json(product, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ barcode: string }> }) {
  const { barcode } = await context.params;
  if (!BARCODE_PATTERN.test(barcode)) {
    return Response.json({ error: "Enter a 7–14 digit food barcode." }, { status: 400 });
  }

  let body: SaveProductBody;
  try {
    body = (await request.json()) as SaveProductBody;
  } catch {
    return Response.json({ error: "Invalid product data." }, { status: 400 });
  }

  const name = text(body?.name);
  const per100g: ProductNutrition = {
    calories: submittedNutritionValue(body?.per100g?.calories) ?? Number.NaN,
    protein_g: submittedNutritionValue(body?.per100g?.protein_g) ?? Number.NaN,
    carbs_g: submittedNutritionValue(body?.per100g?.carbs_g) ?? Number.NaN,
    fat_g: submittedNutritionValue(body?.per100g?.fat_g) ?? Number.NaN,
  };
  if (!name || Object.values(per100g).some((value) => !Number.isFinite(value))) {
    return Response.json(
      { error: "Enter a product name and all four nutrition values per 100 g." },
      { status: 400 },
    );
  }

  try {
    const product = await saveBarcodeProduct(barcode, name, per100g);
    return Response.json(product, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("barcode product save failed:", error);
    return Response.json(
      { error: "Couldn't save this barcode. Try again shortly." },
      { status: 500 },
    );
  }
}
