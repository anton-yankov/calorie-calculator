"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProductAction, saveProductAction } from "@/app/actions";
import { ProductPhotoInput } from "@/components/ProductPhotoInput";
import type { BarcodeProduct, ProductNutrition } from "@/lib/products";

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

/** Energy each macro contributes per gram, for the split bar. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const MACROS = [
  { key: "protein_g", label: "protein", swatch: "bg-success", kcal: KCAL_PER_GRAM.protein },
  { key: "carbs_g", label: "carbs", swatch: "bg-accent", kcal: KCAL_PER_GRAM.carbs },
  { key: "fat_g", label: "fat", swatch: "bg-muted", kcal: KCAL_PER_GRAM.fat },
] as const;

/** Barcode-stripe placeholder for products without a photo. */
function BarcodeGlyph() {
  const widths = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 2];
  let x = 0;
  return (
    <svg viewBox="0 0 32 20" className="h-6 w-9 text-muted/70" aria-hidden>
      {widths.map((w, i) => {
        const bar = <rect key={i} x={x} y={0} width={w} height={20} fill="currentColor" />;
        x += w + 1;
        return bar;
      })}
    </svg>
  );
}

function ProductImage({ product }: { product: BarcodeProduct }) {
  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-background">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small data URL
        <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <BarcodeGlyph />
      )}
    </div>
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
          className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-line"
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
      <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
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

const inputClass =
  "w-full rounded-panel border border-line bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

interface Draft {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  imageUrl: string | null;
}

function draftFrom(product: BarcodeProduct): Draft {
  return {
    name: product.name,
    calories: fmt(product.per100g.calories),
    protein: fmt(product.per100g.protein_g),
    carbs: fmt(product.per100g.carbs_g),
    fat: fmt(product.per100g.fat_g),
    imageUrl: product.imageUrl,
  };
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
  const [draft, setDraft] = useState<Draft>(() => draftFrom(product));
  const [error, setError] = useState<string | null>(null);

  const fields = [
    ["calories", "Calories", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Carbs", "g"],
    ["fat", "Fat", "g"],
  ] as const;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [draft.calories, draft.protein, draft.carbs, draft.fat];
    const complete =
      draft.name.trim() !== "" &&
      values.every((value) => {
        const number = Number(value);
        return value.trim() !== "" && Number.isFinite(number) && number >= 0;
      });
    if (!complete) {
      setError("Enter a name and all four values per 100 g or ml.");
      return;
    }
    setError(null);
    onSave(draft);
  }

  return (
    <form onSubmit={submit} className="border-t border-line bg-surface-raised">
      <div className="flex flex-col gap-4 p-4">
        <ProductPhotoInput
          imageUrl={draft.imageUrl}
          productName={draft.name.trim() || product.name}
          disabled={pending}
          onChange={(imageUrl) => setDraft((current) => ({ ...current, imageUrl }))}
        />
        <label className="block text-xs font-semibold text-muted">
          Product name
          <input
            value={draft.name}
            disabled={pending}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <legend className="mb-2 text-xs font-semibold text-muted">Per 100 g or ml</legend>
          {fields.map(([key, label, unit]) => (
            <label key={key} className="text-xs font-semibold text-muted">
              {label}
              <span className="mt-1 flex items-center rounded-panel border border-line bg-background focus-within:border-accent">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft[key]}
                  disabled={pending}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm tabular-nums text-foreground focus:outline-none"
                />
                <span className="pr-3 font-normal">{unit}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <div className="flex gap-2 border-t border-line p-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-panel border border-line px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProductCard({ product }: { product: BarcodeProduct }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleSave(draft: Draft) {
    startTransition(async () => {
      const result = await saveProductAction(product.barcode, {
        name: draft.name.trim(),
        per100g: {
          calories: Number(draft.calories),
          protein_g: Number(draft.protein),
          carbs_g: Number(draft.carbs),
          fat_g: Number(draft.fat),
        },
        imageUrl: draft.imageUrl,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Product updated");
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
      // Undo re-saves the exact same row — the client still holds all of it
      toast(`${product.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void saveProductAction(product.barcode, {
              name: product.name,
              per100g: product.per100g,
              imageUrl: product.imageUrl,
            }).then((r) => {
              if (r.error) toast.error(r.error);
            }),
        },
      });
    });
  }

  return (
    <article
      aria-label={product.name}
      className={`overflow-hidden rounded-panel border border-line bg-surface transition-opacity ${pending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-4 p-4">
        {/* The editor shows its own photo control, so the tile would be a duplicate */}
        {!editing && <ProductImage product={product} />}
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-serif text-lg font-semibold leading-tight">
            {product.name}
          </h2>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted">{product.barcode}</p>
        </div>
        <p className="shrink-0 text-right font-mono tabular-nums">
          <span className="block text-xl font-bold leading-none">
            {Math.round(product.per100g.calories)}
          </span>
          <span className="mt-1 block text-[10px] text-muted">kcal / 100 g</span>
        </p>
      </div>

      {editing ? (
        <ProductEditor
          product={product}
          pending={pending}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="px-4 pb-4">
            <MacroSplit per100g={product.per100g} />
          </div>
          <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs font-semibold">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              className="text-accent hover:underline disabled:text-muted"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="ml-auto text-danger hover:underline disabled:text-muted"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export function ProductList({ products }: { products: BarcodeProduct[] }) {
  const [query, setQuery] = useState("");

  if (products.length === 0) {
    return (
      <div className="rounded-panel border-2 border-dashed border-line bg-surface/40 px-5 py-14 text-center text-muted">
        <p className="font-serif text-xl font-semibold text-foreground">No saved products yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm">
          Scan a barcode on Analyze. When a product isn’t in the catalog, enter its nutrition and it
          will be kept here for next time.
        </p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {products.length}
          </span>{" "}
          {products.length === 1 ? "product" : "products"}, A to Z
        </p>
        {products.length > 5 && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find by name or barcode"
            aria-label="Find a product by name or barcode"
            className="w-full rounded-panel border border-line bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none sm:w-64"
          />
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-panel border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nothing matches “{query.trim()}”.
        </p>
      ) : (
        visible.map((product) => <ProductCard key={product.barcode} product={product} />)
      )}
    </section>
  );
}
