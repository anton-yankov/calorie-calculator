"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Spinner } from "@/components/loaders";
import { NutritionLabelInput } from "@/components/NutritionLabelInput";
import { ProductPhotoInput } from "@/components/ProductPhotoInput";
import {
  barcodeProductToFood,
  manualProductToFood,
  type BarcodeProduct,
  type ProductNutrition,
} from "@/lib/products";
import type { FoodItem } from "@/lib/schema";
import type { NutritionLabelAnalysis } from "@/lib/nutrition-label";

interface LookupError {
  error: string;
  product?: { name?: string; brand?: string };
}

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

function ManualNutrition({
  barcode,
  initialName,
  onAdd,
  onCancel,
}: {
  barcode: string;
  initialName: string;
  onAdd: (
    food: FoodItem,
    name: string,
    per100g: ProductNutrition,
    imageUrl: string | null,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [grams, setGrams] = useState("100");
  const [nutrition, setNutrition] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const portion = Number(grams);
    const per100g: ProductNutrition = {
      calories: Number(nutrition.calories),
      protein_g: Number(nutrition.protein),
      carbs_g: Number(nutrition.carbs),
      fat_g: Number(nutrition.fat),
    };
    const complete =
      name.trim() &&
      Number.isFinite(portion) &&
      portion > 0 &&
      Object.values(nutrition).every((value) => value.trim() !== "") &&
      Object.values(per100g).every((value) => Number.isFinite(value) && value >= 0);
    if (!complete) {
      setError("Enter a name, portion, and all four values per 100 g or ml.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(
        manualProductToFood(name, portion, per100g, barcode),
        name.trim(),
        per100g,
        imageUrl,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this barcode.");
    } finally {
      setSaving(false);
    }
  }

  const nutritionFields = [
    ["calories", "Calories", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Carbs", "g"],
    ["fat", "Fat", "g"],
  ] as const;

  function applyLabel(result: NutritionLabelAnalysis) {
    if (!name.trim() && result.productName.trim()) setName(result.productName.trim());
    setNutrition((current) => ({
      calories: result.calories === null ? current.calories : String(result.calories),
      protein: result.protein_g === null ? current.protein : String(result.protein_g),
      carbs: result.carbs_g === null ? current.carbs : String(result.carbs_g),
      fat: result.fat_g === null ? current.fat : String(result.fat_g),
    }));
    setError(null);
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-line bg-surface p-4">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Manual nutrition
        </p>
        <p className="mt-1 text-xs text-muted">
          Scan the label to fill the fields, then confirm them against the package.
        </p>
      </div>
      <div className="mb-4">
        <NutritionLabelInput disabled={saving} onExtracted={applyLabel} />
      </div>
      <div className="mb-4 border-b border-line pb-4">
        <p className="mb-2 text-xs font-semibold text-muted">Product photo (optional)</p>
        <ProductPhotoInput
          imageUrl={imageUrl}
          productName={name.trim() || "product"}
          disabled={saving}
          onChange={setImageUrl}
        />
      </div>
      <label className="mb-3 block text-xs font-semibold text-muted">
        Product name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-panel border border-line bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {nutritionFields.map(([key, label, unit]) => (
          <label key={key} className="text-xs font-semibold text-muted">
            {label} / 100 g or ml
            <span className="mt-1 flex items-center rounded-panel border border-line bg-background focus-within:border-accent">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={nutrition[key]}
                onChange={(event) =>
                  setNutrition((current) => ({ ...current, [key]: event.target.value }))
                }
                className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-foreground focus:outline-none"
              />
              <span className="pr-3 font-normal">{unit}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold text-muted">
        Amount eaten
        <span className="mt-1 flex items-center rounded-panel border border-line bg-background focus-within:border-accent">
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-foreground focus:outline-none"
          />
          <span className="pr-3 font-normal">g / ml</span>
        </span>
      </label>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-background"
        >
          {saving ? "Saving…" : "Save and add to meal"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-panel border border-line px-4 py-2.5 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProductConfirmation({
  product,
  onAdd,
  onCancel,
}: {
  product: BarcodeProduct;
  onAdd: (food: FoodItem) => void;
  onCancel: () => void;
}) {
  const [grams, setGrams] = useState(String(Math.round(product.servingGrams ?? 100)));
  const portion = Number(grams);
  const ratio = Number.isFinite(portion) && portion > 0 ? portion / 100 : 0;

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex gap-3 p-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external crowdsourced product image
          <img
            src={product.imageUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-panel bg-background object-contain"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel border border-line bg-background font-mono text-xl text-muted">
            |||
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="truncate text-xs text-muted">
            {product.brand || `Barcode ${product.barcode}`}
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-muted">
            {fmt(product.per100g.calories)} kcal · P {fmt(product.per100g.protein_g)} · C{" "}
            {fmt(product.per100g.carbs_g)} · F {fmt(product.per100g.fat_g)} / 100 g/ml
          </p>
        </div>
      </div>
      <div className="border-t border-line px-4 py-3">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Amount eaten
          <span className="flex items-center rounded-md border border-line bg-background focus-within:border-accent">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              className="w-20 bg-transparent px-2 py-1.5 text-right font-mono tabular-nums focus:outline-none"
            />
            <span className="pr-2 text-xs text-muted">g</span>
          </span>
        </label>
        <p className="mt-2 text-right font-mono text-xs text-muted">
          {Math.round(product.per100g.calories * ratio)} kcal for this amount
        </p>
      </div>
      <div className="flex gap-2 border-t border-line p-3">
        <button
          type="button"
          disabled={!Number.isFinite(portion) || portion <= 0}
          onClick={() => onAdd(barcodeProductToFood(product, portion))}
          className="flex-1 rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
        >
          Add to meal
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-panel border border-line px-4 py-2.5 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
      </div>
      <p className="border-t border-line px-4 py-2 text-[10px] text-muted">
        {product.source === "saved" ? (
          "Nutrition saved from an earlier manual entry. Confirm it against the package."
        ) : (
          <>
            Product data from{" "}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-foreground"
            >
              Open Food Facts
            </a>
            . Confirm it against the package.
          </>
        )}
      </p>
    </section>
  );
}

export function BarcodeInput({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (food: FoodItem) => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");

  async function lookup(code: string) {
    setScannerOpen(false);
    setBarcode(code);
    setLoading(true);
    setProduct(null);
    setLookupError(null);
    setManualName("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(code)}`);
      const body = (await response.json()) as BarcodeProduct | LookupError;
      if (!response.ok || "error" in body) {
        const problem = body as LookupError;
        setLookupError(problem.error);
        setManualName([problem.product?.brand, problem.product?.name].filter(Boolean).join(" "));
        return;
      }
      setProduct(body);
    } catch {
      setLookupError(
        "Product lookup failed. Check your connection or enter the nutrition manually.",
      );
    } finally {
      setLoading(false);
    }
  }

  function add(food: FoodItem) {
    onAdd(food);
    setProduct(null);
    setLookupError(null);
    setBarcode("");
    toast.success(`${food.name} added`);
  }

  async function saveManual(
    food: FoodItem,
    name: string,
    per100g: ProductNutrition,
    imageUrl: string | null,
  ) {
    const response = await fetch(`/api/products/${encodeURIComponent(barcode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, per100g, imageUrl }),
    });
    const body = (await response.json()) as BarcodeProduct | LookupError;
    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error : "Couldn't save this barcode.");
    }
    add(food);
  }

  function clear() {
    setProduct(null);
    setLookupError(null);
    setBarcode("");
    setManualName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setScannerOpen(true)}
        className="flex items-center justify-center gap-2 rounded-panel border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-raised disabled:opacity-40"
      >
        {loading ? <Spinner className="h-4 w-4" /> : <span aria-hidden>▥</span>}
        {loading ? `Looking up ${barcode}…` : "Scan a product barcode"}
      </button>

      {product && <ProductConfirmation product={product} onAdd={add} onCancel={clear} />}

      {lookupError && (
        <div>
          <p className="mb-2 rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
            {lookupError}
          </p>
          <ManualNutrition
            key={barcode}
            barcode={barcode}
            initialName={manualName}
            onAdd={saveManual}
            onCancel={clear}
          />
        </div>
      )}

      {scannerOpen && (
        <BarcodeScanner
          onDetected={(code) => void lookup(code)}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
