"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/Button";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { Field } from "@/components/fields";
import { NutritionLabelInput } from "@/components/NutritionLabelInput";
import { ProductPhotoInput } from "@/components/ProductPhotoInput";
import { foodImageFrom, ProductSheet, type ProductTarget } from "@/components/ProductSheet";
import { Sheet } from "@/components/Sheet";
import { useWaterTracking } from "@/components/WaterTracking";
import type { NutritionLabelAnalysis } from "@/lib/nutrition-label";
import { manualProductToFood, type BarcodeProduct, type ProductNutrition } from "@/lib/products";
import type { FoodItem } from "@/lib/schema";
import { detectDrinkType, type DrinkType } from "@/lib/water";

interface LookupError {
  error: string;
  product?: { name?: string; brand?: string };
}

/**
 * A product the catalog doesn't know: scan its nutrition label (or type the
 * values), and it's saved to Products when logged. The unit follows the
 * product: ml for drinks or a "per 100 ml" label, g otherwise.
 */
function NewProductForm({
  barcode,
  initialName,
  target,
  onAdd,
  onCancel,
}: {
  barcode: string;
  initialName: string;
  target: ProductTarget;
  onAdd: (food: FoodItem) => Promise<void>;
  onCancel: () => void;
}) {
  const waterTracking = useWaterTracking();
  const [name, setName] = useState(initialName);
  const [drinkOverride, setDrinkOverride] = useState<DrinkType | null | undefined>(undefined);
  const drinkType = drinkOverride === undefined ? detectDrinkType(name) : drinkOverride;
  const [labelUnit, setLabelUnit] = useState<"g" | "ml" | null>(null);
  const unit = labelUnit ?? (drinkType ? "ml" : "g");
  const [amount, setAmount] = useState("100");
  const [values, setValues] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function applyLabel(result: NutritionLabelAnalysis) {
    if (result.basis === "per_100_ml") setLabelUnit("ml");
    if (result.basis === "per_100_g") setLabelUnit("g");
    if (!name.trim() && result.productName.trim()) setName(result.productName.trim());
    setValues((current) => ({
      calories: result.calories === null ? current.calories : String(result.calories),
      protein: result.protein_g === null ? current.protein : String(result.protein_g),
      carbs: result.carbs_g === null ? current.carbs : String(result.carbs_g),
      fat: result.fat_g === null ? current.fat : String(result.fat_g),
    }));
    setError(null);
  }

  async function submit() {
    const portion = Number(amount);
    const per100g: ProductNutrition = {
      calories: Number(values.calories),
      protein_g: Number(values.protein),
      carbs_g: Number(values.carbs),
      fat_g: Number(values.fat),
    };
    const complete =
      name.trim() &&
      Number.isFinite(portion) &&
      portion > 0 &&
      Object.values(values).every((value) => value.trim() !== "") &&
      Object.values(per100g).every((value) => Number.isFinite(value) && value >= 0);
    if (!complete) {
      setError(`Enter a name, the amount, and all four values per 100 ${unit}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(
        manualProductToFood(
          name,
          portion,
          per100g,
          barcode,
          await foodImageFrom(imageUrl),
          unit,
          drinkType,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-[13px] text-muted">
        Scan the nutrition label to fill the values, then check them against the package.
      </p>
      <NutritionLabelInput disabled={saving} onExtracted={applyLabel} />
      <ProductPhotoInput
        imageUrl={imageUrl}
        productName={name.trim() || "product"}
        disabled={saving}
        onChange={setImageUrl}
      />
      <Field label="Product name" value={name} onChange={setName} inputMode="text" />
      {waterTracking && (
        <DrinkTypeSelect
          value={drinkType}
          name={name || "product"}
          onChange={setDrinkOverride}
          disabled={saving}
        />
      )}
      <p className="-mb-1 text-[12.5px] font-semibold text-muted">Per 100 {unit}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field
          label="Calories"
          unit="kcal"
          value={values.calories}
          onChange={set("calories")}
          inputMode="decimal"
        />
        <Field
          label="Protein"
          unit="g"
          value={values.protein}
          onChange={set("protein")}
          inputMode="decimal"
        />
        <Field
          label="Carbs"
          unit="g"
          value={values.carbs}
          onChange={set("carbs")}
          inputMode="decimal"
        />
        <Field label="Fat" unit="g" value={values.fat} onChange={set("fat")} inputMode="decimal" />
      </div>
      <Field
        label="How much did you have?"
        unit={unit}
        value={amount}
        onChange={setAmount}
        inputMode="decimal"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" pending={saving} onClick={() => void submit()}>
          {saving ? "Adding…" : target === "meal" ? "Add to this meal" : "Add to today"}
        </Button>
      </div>
      <p className="text-xs text-muted">Saved to Products, so next time it&apos;s one scan.</p>
    </>
  );
}

/**
 * Scanning a barcode from the homepage: the camera first, then the product
 * as a sheet, or the new-product form when the catalog doesn't know it.
 * Mounted while the flow runs; `onDone` closes it from any step.
 */
export function BarcodeFlow({
  target,
  onAdd,
  onDone,
}: {
  target: ProductTarget;
  /** Receives the food; `day` is null for today (and always null when adding to the meal) */
  onAdd: (food: FoodItem, day: string | null) => Promise<void>;
  onDone: () => void;
}) {
  const [scanning, setScanning] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [looking, setLooking] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [missing, setMissing] = useState<{ error: string; name: string } | null>(null);

  // Starts as soon as the code is read, while the scanner is still showing it
  async function lookup(code: string) {
    setBarcode(code);
    setLooking(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as BarcodeProduct | LookupError;
      if (!response.ok || "error" in body) {
        const problem = body as LookupError;
        setMissing({
          error: problem.error,
          name: [problem.product?.brand, problem.product?.name].filter(Boolean).join(" "),
        });
        return;
      }
      setProduct(body);
    } catch {
      setMissing({
        error: "Product lookup failed. Check your connection, or enter the nutrition yourself.",
        name: "",
      });
    } finally {
      setLooking(false);
    }
  }

  async function add(food: FoodItem, day: string | null) {
    await onAdd(food, day);
    onDone();
  }

  if (scanning) {
    return (
      <BarcodeScanner
        onRead={(code) => void lookup(code)}
        onFinished={() => setScanning(false)}
        onClose={onDone}
      />
    );
  }
  return (
    <>
      <Sheet open={looking} onClose={onDone} title="Looking it up…">
        <p className="text-sm text-muted">Barcode {barcode}</p>
      </Sheet>
      {product && (
        <ProductSheet product={product} open onClose={onDone} target={target} onAdd={add} />
      )}
      {missing && (
        <Sheet open onClose={onDone} title="Add this product">
          <p className="flex items-start gap-2.5 rounded-panel bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
            <TriangleAlert
              className="mt-px h-[18px] w-[18px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            {missing.error}
          </p>
          <NewProductForm
            barcode={barcode}
            initialName={missing.name}
            target={target}
            onAdd={(food) => add(food, null)}
            onCancel={onDone}
          />
        </Sheet>
      )}
    </>
  );
}
