/**
 * Rosie API client (tenant-aware).
 *
 * IMPORTANT — verification needed before live use:
 * Rosie's storefront API is not publicly documented. The endpoints below
 * reflect the path shape observed on Rosie-powered grocer sites at time of
 * writing but MUST be verified against the actual responses (open devtools
 * on a real Rosie storefront, capture a search and a store-detail request,
 * diff against the shapes consumed by `normalize.ts`).
 *
 * Each request is scoped to a tenant via host + storeSlug. The tenant is
 * resolved from the chain slug in the orchestrator.
 */

import type { RosieTenant } from './tenants';

export interface RawRosieStore {
  id?: string;
  name?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  geo?: {
    latitude?: number;
    longitude?: number;
  };
}

interface RawStoreDetailResponse {
  store?: RawRosieStore;
  /** Some Rosie versions wrap under `data`. */
  data?: { store?: RawRosieStore };
}

export async function fetchStore(tenant: RosieTenant): Promise<RawRosieStore | null> {
  const url = new URL(
    `https://${tenant.host}/api/v3/stores/${encodeURIComponent(tenant.storeSlug)}`,
  );
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Rosie store ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawStoreDetailResponse;
  return json.store ?? json.data?.store ?? null;
}

export interface RawRosieProduct {
  id?: string;
  /** Sometimes a separate stable id; fall back to `id` when missing. */
  productId?: string;
  name?: string;
  brand?: string;
  imageUrl?: string;
  /** Decimal dollars for the regular price. */
  price?: number;
  /** Decimal dollars for the sale price when present (Rosie does sale prices via this field). */
  salePrice?: number;
  /** ISO date for sale end. */
  saleEndsOn?: string;
  /** Size string from the product (e.g., "1 gal" or "16 oz"). */
  size?: string;
  /** Aisle / department label, when surfaced. */
  category?: string;
  /** UPC, when known. */
  upc?: string;
}

interface RawSearchResponse {
  products?: RawRosieProduct[];
  data?: { products?: RawRosieProduct[] };
}

export async function fetchSearch(
  tenant: RosieTenant,
  keyword: string,
  limit = 5,
): Promise<RawRosieProduct[]> {
  const url = new URL(
    `https://${tenant.host}/api/v3/stores/${encodeURIComponent(tenant.storeSlug)}/products`,
  );
  url.searchParams.set('search', keyword);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Rosie search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawSearchResponse;
  return json.products ?? json.data?.products ?? [];
}
