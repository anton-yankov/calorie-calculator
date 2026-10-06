import type { BarcodeProduct } from "@/lib/products";

/** How many recently logged products lead the list before anything is typed. */
export const RECENT_COUNT = 5;

export interface ProductSearchResult {
  /** Recently logged, newest first; empty once something is typed */
  recent: BarcodeProduct[];
  /** Everything else, in the order given (A to Z), or every match when searching */
  rest: BarcodeProduct[];
}

const loggedTime = (product: BarcodeProduct) =>
  product.lastLoggedAt ? Date.parse(product.lastLoggedAt) : Number.NaN;

/**
 * Splits saved products for the homepage search. With no query, the last few
 * logged lead and the rest follow A to Z; with one, products whose name or
 * barcode contains it, recently logged ones first.
 */
export function searchProducts(products: BarcodeProduct[], query: string): ProductSearchResult {
  const needle = query.trim().toLowerCase();
  const byRecency = products
    .filter((product) => !Number.isNaN(loggedTime(product)))
    .sort((a, b) => loggedTime(b) - loggedTime(a));
  if (needle) {
    const matches = (product: BarcodeProduct) =>
      product.name.toLowerCase().includes(needle) || product.barcode.includes(needle);
    const recent = byRecency.filter(matches);
    return {
      recent: [],
      rest: [...recent, ...products.filter((p) => matches(p) && !recent.includes(p))],
    };
  }
  const recent = byRecency.slice(0, RECENT_COUNT);
  return { recent, rest: products.filter((product) => !recent.includes(product)) };
}
