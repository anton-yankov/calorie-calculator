"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ProductPhotoInput } from "@/components/ProductPhotoInput";
import type { BarcodeProduct } from "@/lib/products";

const fmt = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

function ProductEntry({
  product,
  onUpdate,
}: {
  product: BarcodeProduct;
  onUpdate: (product: BarcodeProduct) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function updateImage(imageUrl: string | null) {
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.barcode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const body = (await response.json()) as BarcodeProduct | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Couldn't update the product image.");
      }
      onUpdate(body);
      toast.success(imageUrl ? "Product image saved" : "Product image removed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="grid gap-4 border-b border-line py-5 first:pt-0 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
      <ProductPhotoInput
        imageUrl={product.imageUrl}
        productName={product.name}
        disabled={saving}
        onChange={updateImage}
      />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-base font-semibold leading-snug">
            {product.name}
          </h2>
          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
            Saved
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">Barcode {product.barcode}</p>
        <dl className="mt-3 grid grid-cols-4 divide-x divide-line border-y border-line py-2">
          {(
            [
              ["kcal", product.per100g.calories],
              ["protein", product.per100g.protein_g],
              ["carbs", product.per100g.carbs_g],
              ["fat", product.per100g.fat_g],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="px-2 first:pl-0 last:pr-0">
              <dt className="text-[9px] uppercase tracking-[0.08em] text-muted">{label}</dt>
              <dd className="mt-0.5 font-mono text-xs tabular-nums">
                {fmt(value)}
                {label === "kcal" ? "" : " g"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-right text-[10px] text-muted">Values per 100 g/ml</p>
      </div>
    </article>
  );
}

export function ProductList({ initialProducts }: { initialProducts: BarcodeProduct[] }) {
  const [products, setProducts] = useState(initialProducts);

  if (products.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-panel border-2 border-dashed border-line px-6 text-center">
        <p className="font-semibold">No saved products yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Scan a barcode on Analyze. If the product is missing, enter its nutrition and it will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <section aria-label={`${products.length} saved products`}>
      <p className="mb-4 text-xs font-semibold text-muted">
        {products.length} {products.length === 1 ? "product" : "products"}
      </p>
      {products.map((product) => (
        <ProductEntry
          key={product.barcode}
          product={product}
          onUpdate={(updated) =>
            setProducts((current) =>
              current.map((item) => (item.barcode === updated.barcode ? updated : item)),
            )
          }
        />
      ))}
    </section>
  );
}
