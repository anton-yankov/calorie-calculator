"use client";

import { Barcode, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/loaders";
import { foodImageFrom, ProductSheet, type ProductTarget } from "@/components/ProductSheet";
import { Sheet } from "@/components/Sheet";
import { searchProducts } from "@/lib/product-search";
import { barcodeProductToFood, type BarcodeProduct } from "@/lib/products";
import type { FoodItem } from "@/lib/schema";
import { detectDrinkType } from "@/lib/water";

const LOAD_ERROR = "Couldn't load your products. Check your connection and try again.";

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

/** The unit a product is measured in, decided the same way as on the product sheet. */
function unitOf(product: BarcodeProduct): "g" | "ml" {
  const drinkType =
    product.drinkType !== undefined ? product.drinkType : detectDrinkType(product.name);
  return product.portionUnit ?? (drinkType ? "ml" : "g");
}

/** The amount + logs: what was logged last time, else the package serving, else 100. */
const amountOf = (product: BarcodeProduct) => product.servingGrams ?? 100;

function ProductThumb({ product }: { product: BarcodeProduct }) {
  if (product.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small data URL, nothing to optimise
      <img
        src={product.imageUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-[14px] bg-background object-contain"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-surface-raised text-muted">
      <Barcode className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/** One product: tap it to choose the amount, or + to add last time's amount straight away. */
function ResultRow({
  product,
  target,
  adding,
  disabled,
  onOpen,
  onQuickAdd,
}: {
  product: BarcodeProduct;
  target: ProductTarget;
  adding: boolean;
  disabled: boolean;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  const unit = unitOf(product);
  const amount = amountOf(product);
  const kcal = Math.round((product.per100g.calories * amount) / 100);
  return (
    <li className="flex items-center gap-2 border-t border-line first:border-t-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left disabled:opacity-60"
      >
        <ProductThumb product={product} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold">{product.name}</span>
          <span className="block text-[12.5px] text-muted tabular-nums">
            {fmt(amount)} {unit} · {kcal} kcal
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onQuickAdd}
        aria-label={
          target === "meal"
            ? `Add ${fmt(amount)} ${unit} of ${product.name} to the meal`
            : `Log ${fmt(amount)} ${unit} of ${product.name}`
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-accent-soft text-accent transition hover:brightness-125 disabled:opacity-40"
      >
        {adding ? <Spinner /> : <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />}
      </button>
    </li>
  );
}

/**
 * Search from the homepage: every product saved from a barcode, the last
 * few logged on top so the usual ones need no typing. Tapping a product
 * opens the usual amount sheet; + adds last time's amount in one go. The
 * list is fetched on every open, so the order follows what was just logged.
 */
export function ProductSearch({
  open,
  target,
  onAdd,
  onScan,
  onClose,
}: {
  open: boolean;
  target: ProductTarget;
  /** Receives the food; `day` is null for today (and always null when adding to the meal) */
  onAdd: (food: FoodItem, day: string | null) => Promise<void>;
  /** Opens the barcode scanner instead, for a product that isn't saved yet */
  onScan: () => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<BarcodeProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BarcodeProduct | null>(null);
  // The barcode whose + is being added
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // The last list stays on screen while the fresh one loads
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !Array.isArray(body)) throw new Error(LOAD_ERROR);
        if (cancelled) return;
        setProducts(body as BarcodeProduct[]);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function close() {
    setQuery("");
    setSelected(null);
    onClose();
  }

  async function quickAdd(product: BarcodeProduct) {
    setAdding(product.barcode);
    try {
      const food = barcodeProductToFood(
        product,
        amountOf(product),
        await foodImageFrom(product.imageUrl),
      );
      await onAdd(food, null);
      close();
    } finally {
      setAdding(null);
    }
  }

  const { recent, rest } = searchProducts(products ?? [], query);
  const searching = query.trim() !== "";
  const row = (product: BarcodeProduct) => (
    <ResultRow
      key={product.barcode}
      product={product}
      target={target}
      adding={adding === product.barcode}
      disabled={adding !== null}
      onOpen={() => setSelected(product)}
      onQuickAdd={() => void quickAdd(product)}
    />
  );
  const scanButton = (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => {
        close();
        onScan();
      }}
    >
      <Barcode className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
      Scan a barcode
    </Button>
  );

  return (
    <>
      <Sheet open={open && !selected} onClose={close} title="Your products" focusPanel>
        {products?.length !== 0 && (
          // Stays in view while a long list scrolls under it
          <label className="sticky top-0 z-10 -mx-1 -my-1 flex bg-surface px-1 py-1">
            <span className="flex h-12 w-full items-center gap-2.5 rounded-panel border-[1.5px] border-line bg-background px-4 text-muted focus-within:border-accent">
              <Search className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or barcode"
                aria-label="Search your products by name or barcode"
                className="w-full min-w-0 bg-transparent text-[15px] text-foreground placeholder:text-muted focus:outline-none"
              />
            </span>
          </label>
        )}
        {loadError && (
          <p
            role="alert"
            className="rounded-panel bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger"
          >
            {loadError}
          </p>
        )}
        {products === null && !loadError && (
          <div role="status" aria-label="Loading your products" className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ghost-shimmer h-14 rounded-panel bg-surface-raised" />
            ))}
          </div>
        )}
        {products?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="font-extrabold">No saved products yet</p>
            <p className="max-w-xs text-[13.5px] text-muted">
              Every product you scan is saved, so next time you can find it here without the
              barcode.
            </p>
            {scanButton}
          </div>
        )}
        {products && products.length > 0 && (
          <>
            {recent.length > 0 && (
              <section aria-label="Recently logged" className="flex flex-col">
                <h3 className="mb-0.5 text-[12.5px] font-semibold text-muted">Recently logged</h3>
                <ul>{recent.map(row)}</ul>
              </section>
            )}
            {rest.length > 0 && (
              <section
                aria-label={searching ? "Matching products" : "All products"}
                className="flex flex-col"
              >
                {recent.length > 0 && (
                  <h3 className="mb-0.5 text-[12.5px] font-semibold text-muted">All products</h3>
                )}
                <ul>{rest.map(row)}</ul>
              </section>
            )}
            {searching && rest.length === 0 && (
              <div className="flex flex-col gap-3 py-1 text-center">
                <p className="text-sm text-muted">Nothing matches “{query.trim()}”.</p>
                {scanButton}
              </div>
            )}
          </>
        )}
      </Sheet>
      {selected && (
        <ProductSheet
          product={selected}
          open
          onClose={() => setSelected(null)}
          target={target}
          onAdd={async (food, day) => {
            await onAdd(food, day);
            close();
          }}
        />
      )}
    </>
  );
}
