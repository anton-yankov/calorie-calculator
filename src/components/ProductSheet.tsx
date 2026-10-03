"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { ZoomableImage } from "@/components/ImageLightbox";
import { Sheet, SheetBadge } from "@/components/Sheet";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayKey, dayLabel } from "@/lib/day";
import { barcodeProductToFood, type BarcodeProduct } from "@/lib/products";
import { FOOD_IMAGE_EDGE, makeThumbnail } from "@/lib/resize";
import type { FoodItem } from "@/lib/schema";
import { detectDrinkType, formatWater, type DrinkType } from "@/lib/water";

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

/** The small copy of a product image that travels with the food into the meal. */
export async function foodImageFrom(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    return await makeThumbnail(imageUrl, FOOD_IMAGE_EDGE);
  } catch {
    return null; // the food still gets added, just without a picture
  }
}

/**
 * "To the meal" adds the food to the plate being put together on the
 * homepage; "now" logs it on its own, on the chosen day.
 */
export type ProductTarget = "meal" | "now";

function ProductForm({
  product,
  target,
  onAdd,
}: {
  product: BarcodeProduct;
  target: ProductTarget;
  onAdd: (food: FoodItem, day: string | null) => Promise<void>;
}) {
  const waterTracking = useWaterTracking();
  const [grams, setGrams] = useState(String(product.servingGrams ?? 100));
  const [drinkType, setDrinkType] = useState<DrinkType | null>(
    product.drinkType !== undefined ? product.drinkType : detectDrinkType(product.name),
  );
  // null = today
  const [day, setDay] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The unit follows the product: ml for drinks, g for everything else
  const unit = product.portionUnit ?? (drinkType ? "ml" : "g");
  const portion = Number(grams);
  const valid = Number.isFinite(portion) && portion > 0;
  const ratio = valid ? portion / 100 : 0;
  const todayKey = dayKey(new Date());

  async function add() {
    setAdding(true);
    try {
      const food = barcodeProductToFood(
        { ...product, drinkType, portionUnit: unit },
        portion,
        await foodImageFrom(product.imageUrl),
      );
      await onAdd(food, day);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {product.imageUrl && (
          <ZoomableImage
            src={product.imageUrl}
            alt={product.name}
            label={`View image of ${product.name}`}
            className="h-14 w-14 shrink-0 rounded-[16px] bg-background"
            imgClassName="h-full w-full object-contain"
          />
        )}
        <p className="min-w-0 text-[13px] text-muted">
          {product.brand && <span className="block truncate">{product.brand}</span>}
          Per 100 {unit}: {fmt(product.per100g.calories)} kcal · {fmt(product.per100g.protein_g)} g
          protein
        </p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">How much?</span>
        <span className="flex h-12 items-center rounded-panel border-[1.5px] border-line bg-background pr-4 focus-within:border-accent">
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            autoFocus
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="w-full min-w-0 bg-transparent px-4 text-[15px] tabular-nums focus:outline-none"
          />
          <span className="text-sm text-muted">{unit}</span>
        </span>
      </label>
      {waterTracking && (
        <DrinkTypeSelect
          value={drinkType}
          name={product.name}
          onChange={setDrinkType}
          disabled={adding}
        />
      )}
      <p className="flex flex-col gap-0.5 rounded-panel bg-surface-raised px-3 py-2.5 text-[13.5px] text-muted">
        <span className="text-xs">This adds</span>
        <span>
          <b className="text-foreground">{Math.round(product.per100g.calories * ratio)} kcal</b> ·{" "}
          <b className="text-foreground">{Math.round(product.per100g.protein_g * ratio)} g</b>{" "}
          protein
          {waterTracking && drinkType && valid && ` · ${formatWater(portion)} toward Water`}
        </span>
      </p>
      <div className="flex gap-2">
        {target === "now" && (
          <DatePicker
            value={day ?? todayKey}
            max={todayKey}
            disabled={adding}
            onChange={(key) => setDay(key === todayKey ? null : key)}
            ariaLabel="Day to log this to"
            className="h-12 rounded-panel border-[1.5px] border-line-strong bg-transparent px-3.5 text-sm font-bold"
          />
        )}
        <Button className="flex-1" pending={adding} disabled={!valid} onClick={() => void add()}>
          {adding
            ? "Adding…"
            : target === "meal"
              ? "Add to this meal"
              : `Add to ${day ? dayLabel(day) : "today"}`}
        </Button>
      </div>
      <p className="text-xs text-muted">
        {product.source === "saved" ? (
          "Nutrition from your saved Products. Check it against the package."
        ) : (
          <>
            Product data from{" "}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Open Food Facts
            </a>
            . Check it against the package.
          </>
        )}
      </p>
    </>
  );
}

/**
 * A known product: type the amount, see what it adds, add it. Used after a
 * barcode scan on the homepage and by "Log it now" on Products.
 */
export function ProductSheet({
  product,
  open,
  onClose,
  target,
  onAdd,
}: {
  product: BarcodeProduct;
  open: boolean;
  onClose: () => void;
  target: ProductTarget;
  /** Receives the food at the chosen amount; `day` is null for today */
  onAdd: (food: FoodItem, day: string | null) => Promise<void>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product.name}
      badge={product.source === "saved" ? <SheetBadge>Saved product</SheetBadge> : undefined}
    >
      {open && <ProductForm product={product} target={target} onAdd={onAdd} />}
    </Sheet>
  );
}
