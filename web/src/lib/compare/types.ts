/**
 * Comparison input/output contract — shared between API route and client.
 * Money is always in integer cents.
 */

export interface CompareRequestItem {
  intent: 'generic' | 'branded';
  conceptSlug?: string; // present when intent === 'generic'
  upc?: string;         // present when intent === 'branded'
  rawQuery: string;
  displayName: string;
  quantity: number;
  /** Department slug, mirrored from the user's list item; used by Shopping Mode for grouping. */
  departmentSlug?: string;
}

export interface CompareRequest {
  items: CompareRequestItem[];
  /** Filter results to these chains. Empty/omitted = all known chains. */
  selectedChainSlugs?: string[];
  /** Reserved for future use (multi-location per chain). */
  zip?: string;
}

export type ItemStatus =
  | 'matched'         // a SKU was priced for this item at this store
  | 'unavailable'     // no SKU at this store satisfies the item
  | 'no-price';       // matching SKU exists but no price has been captured yet

export interface ChosenProduct {
  storeProductId: string;
  storeSku: string;
  name: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  imageUrl: string | null;
  unitPriceCents: number;       // effective per-unit price (sale or regular)
  regularCents: number;
  saleCents: number | null;
  saleEndsOn: string | null;    // ISO date
}

export interface CompareItemResult {
  rawQuery: string;
  displayName: string;
  quantity: number;
  status: ItemStatus;
  chosenProduct: ChosenProduct | null;
  /** Line total in cents (unitPriceCents * quantity), 0 when unavailable. */
  lineTotalCents: number;
  /** Echoed from the request item; used by Shopping Mode for grouping. */
  departmentSlug?: string;
}

export interface StoreComparison {
  chainSlug: string;
  chainName: string;
  storeLocationId: string;
  storeLocationName: string;
  storeLocationAddress: string;
  totalCents: number;
  matchedCount: number;
  unavailableCount: number;
  onSaleCount: number;
  items: CompareItemResult[];
}

export interface CompareResponse {
  results: StoreComparison[];
  /** chainSlug of the cheapest store with at least one matched item. */
  winnerChainSlug: string | null;
  /** Savings vs second-cheapest, in cents. 0 if only one store. */
  savingsCents: number;
}
