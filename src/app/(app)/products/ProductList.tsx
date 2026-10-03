"use client";

import { Barcode, Ellipsis, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProductAction, saveProductAction } from "@/app/actions";
import { Button, ButtonLink } from "@/components/Button";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { Field } from "@/components/fields";
import { ZoomableImage } from "@/components/ImageLightbox";
import { logFoodsNow, loggedToast } from "@/components/meals/logFood";
import { ProductPhotoInput } from "@/components/ProductPhotoInput";
import { ProductSheet } from "@/components/ProductSheet";
import { Sheet } from "@/components/Sheet";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayLabel } from "@/lib/day";
import type { BarcodeProduct, ProductNutrition } from "@/lib/products";
import { detectDrinkType, type DrinkType } from "@/lib/water";

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

/** Energy each macro contributes per gram, for the split bar. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const MACROS = [
  { key: "protein_g", label: "protein", swatch: "bg-success", kcal: KCAL_PER_GRAM.protein },
  { key: "carbs_g", label: "carbs", swatch: "bg-accent", kcal: KCAL_PER_GRAM.carbs },
  { key: "fat_g", label: "fat", swatch: "bg-amber", kcal: KCAL_PER_GRAM.fat },
] as const;

/** The unit a product is measured in: ml for drinks, g for everything else. */
const unitOf = (product: BarcodeProduct) =>
  product.portionUnit ?? (detectDrinkType(product.name) ? "ml" : "g");

/** The product's picture (tap for full size), or a barcode icon when it has none. */
function ProductImage({ product }: { product: BarcodeProduct }) {
  if (product.imageUrl) {
    return (
      <ZoomableImage
        src={product.imageUrl}
        alt={product.name}
        label={`View image of ${product.name}`}
        className="h-14 w-14 shrink-0 rounded-[16px] bg-background"
        imgClassName="h-full w-full object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-surface-raised text-muted"
    >
      <Barcode className="h-6 w-6" strokeWidth={1.75} />
    </span>
  );
}

/** Proportional bar of where the calories come from, plus the gram figures. */
function MacroSplit({ per100g }: { per100g: ProductNutrition }) {
  const energy = MACROS.map((macro) => per100g[macro.key] * macro.kcal);
  const total = energy.reduce((sum, value) => sum + value, 0);

  return (
    <div>
      {total > 0 && (
        <div
          className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-line-strong"
          role="img"
          aria-label={MACROS.map(
            (macro, i) => `${macro.label} ${Math.round((energy[i]! / total) * 100)}% of energy`,
          ).join(", ")}
        >
          {MACROS.map((macro, i) =>
            energy[i]! > 0 ? (
              <span
                key={macro.key}
                className={macro.swatch}
                style={{ width: `${(energy[i]! / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      )}
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] tabular-nums">
        {MACROS.map((macro) => (
          <div key={macro.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${macro.swatch}`} aria-hidden />
            <dd className="text-foreground">{fmt(per100g[macro.key])} g</dd>
            <dt className="text-muted">{macro.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface Draft {
  drinkType: DrinkType | null;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  imageUrl: string | null;
  /** Amount prefilled on scan; empty for none. */
  serving: string;
}

function draftFrom(product: BarcodeProduct): Draft {
  return {
    drinkType: product.drinkType !== undefined ? product.drinkType : detectDrinkType(product.name),
    name: product.name,
    calories: fmt(product.per100g.calories),
    protein: fmt(product.per100g.protein_g),
    carbs: fmt(product.per100g.carbs_g),
    fat: fmt(product.per100g.fat_g),
    imageUrl: product.imageUrl,
    serving: product.servingGrams === null ? "" : fmt(product.servingGrams),
  };
}

/** The draft's default amount as a number, `null` when left empty, `undefined` when invalid. */
function servingFrom(draft: Draft): number | null | undefined {
  if (draft.serving.trim() === "") return null;
  const number = Number(draft.serving);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function ProductEditor({
  product,
  pending,
  onSave,
  onCancel,
}: {
  product: BarcodeProduct;
  pending: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const waterTracking = useWaterTracking();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(product));
  const [error, setError] = useState<string | null>(null);
  // The unit stays the product's own: ml for drinks, g for everything else
  const unit = unitOf(product);
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const preview: ProductNutrition = {
    calories: Number(draft.calories) || 0,
    protein_g: Number(draft.protein) || 0,
    carbs_g: Number(draft.carbs) || 0,
    fat_g: Number(draft.fat) || 0,
  };

  function submit() {
    const values = [draft.calories, draft.protein, draft.carbs, draft.fat];
    const complete =
      draft.name.trim() !== "" &&
      values.every((value) => {
        const number = Number(value);
        return value.trim() !== "" && Number.isFinite(number) && number >= 0;
      });
    if (!complete) {
      setError(`Enter a name and all four values per 100 ${unit}.`);
      return;
    }
    if (servingFrom(draft) === undefined) {
      setError("The amount when scanned must be a positive number, or left empty.");
      return;
    }
    setError(null);
    onSave(draft);
  }

  return (
    <>
      <ProductPhotoInput
        imageUrl={draft.imageUrl}
        productName={draft.name.trim() || product.name}
        disabled={pending}
        onChange={(imageUrl) => setDraft((current) => ({ ...current, imageUrl }))}
      />
      <Field label="Name" value={draft.name} onChange={set("name")} inputMode="text" />
      {waterTracking && (
        <DrinkTypeSelect
          value={draft.drinkType}
          name={draft.name}
          disabled={pending}
          onChange={(drinkType) => setDraft((current) => ({ ...current, drinkType }))}
        />
      )}
      <p className="-mb-1 text-[12.5px] font-semibold text-muted">Per 100 {unit}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field
          label="Calories"
          unit="kcal"
          value={draft.calories}
          onChange={set("calories")}
          inputMode="decimal"
        />
        <Field
          label="Protein"
          unit="g"
          value={draft.protein}
          onChange={set("protein")}
          inputMode="decimal"
        />
        <Field
          label="Carbs"
          unit="g"
          value={draft.carbs}
          onChange={set("carbs")}
          inputMode="decimal"
        />
        <Field label="Fat" unit="g" value={draft.fat} onChange={set("fat")} inputMode="decimal" />
      </div>
      <MacroSplit per100g={preview} />
      <div>
        <Field
          label="Amount when scanned · optional"
          unit={unit}
          value={draft.serving}
          onChange={set("serving")}
          inputMode="decimal"
        />
        <p className="mt-1.5 text-xs text-muted">
          Leave empty to start from 100 {unit}. A whole package or one serving is usually handiest.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" pending={pending} onClick={submit}>
          {pending ? "Saving…" : "Save product"}
        </Button>
      </div>
    </>
  );
}

/** One saved product as a row; ⋯ opens Log it now, Edit and Delete. */
function ProductRow({ product, readOnly }: { product: BarcodeProduct; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const unit = unitOf(product);
  const fields = (draft: Draft | null) => ({
    name: draft ? draft.name.trim() : product.name,
    portionUnit: unit,
    drinkType: draft
      ? draft.drinkType
      : product.drinkType !== undefined
        ? product.drinkType
        : detectDrinkType(product.name),
    per100g: draft
      ? {
          calories: Number(draft.calories),
          protein_g: Number(draft.protein),
          carbs_g: Number(draft.carbs),
          fat_g: Number(draft.fat),
        }
      : product.per100g,
    imageUrl: draft ? draft.imageUrl : product.imageUrl,
    servingGrams: draft ? (servingFrom(draft) ?? null) : product.servingGrams,
  });

  function handleSave(draft: Draft) {
    startTransition(async () => {
      const result = await saveProductAction(product.barcode, fields(draft));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Product saved");
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(product.barcode);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Undo re-saves the exact same row; the client still holds all of it
      toast.success(`${product.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void saveProductAction(product.barcode, fields(null)).then((r) => {
              if (r.error) toast.error(r.error);
            }),
        },
      });
    });
  }

  return (
    <article
      aria-label={product.name}
      className={`flex items-center gap-3 rounded-[20px] bg-surface p-2.5 transition-opacity ${pending ? "opacity-50" : ""}`}
    >
      <ProductImage product={product} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] leading-snug font-bold break-words">{product.name}</h2>
        <p className="text-[12.5px] text-muted tabular-nums">
          {Math.round(product.per100g.calories)} kcal · {fmt(product.per100g.protein_g)} g protein
          per 100 {unit}
        </p>
        {product.servingGrams !== null && (
          <span className="mt-1 inline-block rounded-full bg-accent-soft px-2 py-px text-[11.5px] font-bold text-accent">
            {fmt(product.servingGrams)} {unit} per scan
          </span>
        )}
      </div>
      {!readOnly && (
        <>
          <Button
            variant="outline"
            size="icon"
            aria-label={`More for ${product.name}`}
            disabled={pending}
            onClick={() => setMenuOpen(true)}
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Button>
          <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={product.name}>
            <Button
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                setLogging(true);
              }}
            >
              <Plus className="h-[19px] w-[19px]" strokeWidth={2.25} aria-hidden />
              Log it now
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            >
              <PencilLine className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              Edit product
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                handleDelete();
              }}
            >
              <Trash2 className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              Delete product
            </Button>
          </Sheet>
          <Sheet open={editing} onClose={() => setEditing(false)} title="Edit product">
            {editing && (
              <ProductEditor
                product={product}
                pending={pending}
                onSave={handleSave}
                onCancel={() => setEditing(false)}
              />
            )}
          </Sheet>
          <ProductSheet
            product={{ ...product, source: "saved" }}
            open={logging}
            onClose={() => setLogging(false)}
            target="now"
            onAdd={async (food, day) => {
              const result = await logFoodsNow([food], day);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              setLogging(false);
              loggedToast(
                `${food.name} logged to ${day ? dayLabel(day) : "today"}`,
                result.id,
                () => {},
              );
            }}
          />
        </>
      )}
    </article>
  );
}

/**
 * Every product saved from a barcode, A to Z, with a search field once the
 * list gets long. `readOnly` (the admin's view of another account) hides the
 * ⋯ menus.
 */
export function ProductList({
  products,
  readOnly = false,
}: {
  products: BarcodeProduct[];
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[22px] bg-surface px-5 py-7 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface-raised text-accent">
          <Barcode className="h-7 w-7" strokeWidth={1.9} aria-hidden />
        </span>
        <p className="text-[17px] font-extrabold">No saved products yet</p>
        <p className="max-w-xs text-[13.5px] text-muted">
          {readOnly
            ? "Nothing has been scanned on this account."
            : "Scan a barcode on Home. Every product you scan is saved here, so next time it's one tap."}
        </p>
        {!readOnly && (
          <ButtonLink href="/?scan=1">
            <Barcode className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
            Scan a barcode
          </ButtonLink>
        )}
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(needle) || product.barcode.includes(needle),
      )
    : products;

  return (
    <section aria-label="Saved products" className="flex flex-col gap-3">
      {products.length > 5 && (
        <label className="flex h-12 items-center gap-2.5 rounded-panel bg-surface px-4 text-muted focus-within:ring-2 focus-within:ring-accent lg:max-w-sm">
          <Search className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your products"
            aria-label="Search your products by name or barcode"
            className="w-full min-w-0 bg-transparent text-[15px] text-foreground placeholder:text-muted focus:outline-none"
          />
        </label>
      )}
      {visible.length === 0 ? (
        <p className="rounded-[20px] bg-surface px-5 py-8 text-center text-sm text-muted">
          Nothing matches “{query.trim()}”.
        </p>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <ProductRow key={product.barcode} product={product} readOnly={readOnly} />
          ))}
        </div>
      )}
    </section>
  );
}
