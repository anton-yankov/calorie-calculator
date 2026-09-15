import { detectDrinkType, isDrinkType } from "@/lib/water";
import { getSavedBarcodeProduct, saveBarcodeProduct } from "@/lib/barcode-products";
import { getUserId } from "@/lib/supabase-session";
import {
  BARCODE_PATTERN,
  submittedNutrition,
  submittedProductImage,
  submittedServingGrams,
  type BarcodeProduct,
  type ProductNutrition,
} from "@/lib/products";

export const runtime = "nodejs";

const PRODUCT_FIELDS = [
  "categories_tags",
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "image_front_url",
  "image_front_small_url",
  "nutriments",
  "serving_quantity",
  "serving_quantity_unit",
  "product_quantity",
  "product_quantity_unit",
].join(",");

/** Catalog images larger than this are dropped rather than inlined. */
const MAX_CATALOG_IMAGE_BYTES = 200_000;

interface OpenFoodFactsProduct {
  categories_tags?: string[];
  code?: unknown;
  product_name?: unknown;
  product_name_en?: unknown;
  brands?: unknown;
  image_front_url?: unknown;
  image_front_small_url?: unknown;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
  product_quantity?: unknown;
  product_quantity_unit?: unknown;
  nutriments?: Record<string, unknown>;
}

/**
 * Fetches the catalog image (~400px front shot) and returns it as a JPEG data
 * URL, so the client gets one image shape for saved and catalog products and
 * can copy it into a meal without a cross-origin canvas. The browser could not
 * do this itself: Open Food Facts images are cross-origin. Any failure means
 * no image, never a failed lookup.
 */
async function inlineCatalogImage(product: OpenFoodFactsProduct): Promise<string | null> {
  const url = text(product.image_front_url) || text(product.image_front_small_url);
  if (!url || !/^https:\/\/[^/]*openfoodfacts\.org\//.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").startsWith("image/jpeg")) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_CATALOG_IMAGE_BYTES) return null;
    return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch (error) {
    console.error("catalog image fetch failed:", error);
    return null;
  }
}

interface OpenFoodFactsResponse {
  status?: unknown;
  product?: OpenFoodFactsProduct;
}

interface SaveProductBody {
  portionUnit?: unknown;
  drinkType?: unknown;
  name?: unknown;
  per100g?: unknown;
  imageUrl?: unknown;
  servingGrams?: unknown;
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

/** A positive amount in grams or millilitres; other units can't scale per-100 g nutrition. */
function amount(quantity: unknown, unit: unknown): number | null {
  const value = finite(quantity);
  if (value === null || value <= 0) return null;
  const normalized = text(unit).toLowerCase();
  if (normalized === "l" || normalized === "kg") return value * 1000;
  if (normalized === "cl") return value * 10;
  return normalized === "" || normalized === "g" || normalized === "ml" ? value : null;
}

/**
 * The amount to prefill: the serving size when the catalog has one, otherwise
 * the whole package (many single-serve products only list a net weight).
 */
function defaultAmount(product: OpenFoodFactsProduct): number | null {
  return (
    amount(product.serving_quantity, product.serving_quantity_unit) ??
    amount(product.product_quantity, product.product_quantity_unit)
  );
}

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  // The proxy already rejects logged-out requests; the owner id is needed for the saved lookup
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { barcode } = await context.params;
  if (!BARCODE_PATTERN.test(barcode)) {
    return Response.json({ error: "Enter a 7–14 digit food barcode." }, { status: 400 });
  }

  try {
    const saved = await getSavedBarcodeProduct(userId, barcode);
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

  const categories = source.categories_tags ?? [];
  const drinkType = detectDrinkType(name) ?? (categories.includes("en:beverages") ? "other" : null);
  const catalogUnit = text(source.serving_quantity_unit) || text(source.product_quantity_unit);
  const portionUnit = /^(ml|cl|l)$/i.test(catalogUnit) || (!catalogUnit && drinkType) ? "ml" : "g";
  const product: BarcodeProduct = {
    portionUnit,
    drinkType,
    barcode: text(source.code) || barcode,
    name,
    brand: text(source.brands),
    imageUrl: await inlineCatalogImage(source),
    servingGrams: defaultAmount(source),
    per100g,
    source: "open-food-facts",
  };

  return Response.json(product, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ barcode: string }> }) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Authentication required" }, { status: 401 });

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
  const imageUrl = body.imageUrl === undefined ? null : submittedProductImage(body.imageUrl);
  const per100g = submittedNutrition(body?.per100g);
  const servingGrams = submittedServingGrams(body.servingGrams);
  if (
    !name ||
    imageUrl === undefined ||
    !per100g ||
    servingGrams === undefined ||
    (body.portionUnit !== undefined && body.portionUnit !== "g" && body.portionUnit !== "ml") ||
    (body.drinkType != null && !isDrinkType(body.drinkType))
  ) {
    return Response.json(
      { error: "Enter a product name and all four nutrition values per 100 g or ml." },
      { status: 400 },
    );
  }

  try {
    const product = await saveBarcodeProduct(
      userId,
      barcode,
      name,
      per100g,
      imageUrl,
      servingGrams,
      body.portionUnit as "g" | "ml" | undefined,
      body.drinkType as import("@/lib/water").DrinkType | null | undefined,
    );
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
