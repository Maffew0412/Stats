/**
 * Aldi US (shop.aldi.us) API client.
 *
 * IMPORTANT — verification needed before live use:
 *
 * Unlike Target, Aldi does not publish a developer API. Their pickup/delivery
 * storefront at shop.aldi.us is a SPA backed by JSON endpoints whose URLs and
 * request shapes are not stable and may change across deployments. The paths
 * below reflect the structure observed in their web bundle at time of writing
 * but MUST be re-verified against the live site (open devtools, capture a
 * search or store-locator request, diff against the shapes consumed by
 * `normalize.ts`) before this scraper can be trusted in production.
 *
 * Aldi prices online via curbside pickup match in-store shelf pricing
 * (confirmed during MVP design). There is no native "regular vs sale" field
 * on most catalog items — weekly-ad specials are surfaced separately and
 * not yet captured by this scraper.
 *
 * Override the base URL with ALDI_API_BASE if Aldi changes hosts.
 */

const DEFAULT_BASE = 'https://api.aldi.us';

function baseUrl(): string {
  return process.env.ALDI_API_BASE ?? DEFAULT_BASE;
}

export interface RawAldiStore {
  storeId?: string;
  name?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  geo?: {
    latitude?: number;
    longitude?: number;
  };
}

interface RawStoreLocatorResponse {
  stores?: RawAldiStore[];
}

export async function fetchNearbyStores(zip: string, limit = 5): Promise<RawAldiStore[]> {
  const url = new URL(`${baseUrl()}/v3/locations`);
  url.searchParams.set('postalCode', zip);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Aldi locations ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawStoreLocatorResponse;
  return json.stores ?? [];
}

export interface RawAldiProduct {
  sku?: string;
  /** Some Aldi responses use `productId` instead of `sku`. */
  productId?: string;
  name?: string;
  brand?: string;
  /** Encoded absolute or relative; the normalizer keeps as-is. */
  imageUrl?: string;
  price?: {
    /** Decimal dollars, e.g. 2.79. Some responses use `amount`. */
    value?: number;
    amount?: number;
    currencyCode?: string;
  };
  /** Selected variant size info, when surfaced by the response. */
  size?: {
    value?: string | number;
    unit?: string;
  };
  /** Department / aisle string when present (e.g., "Dairy", "Produce"). */
  category?: string;
}

interface RawSearchResponse {
  data?: {
    products?: RawAldiProduct[];
  };
  /** Some endpoints return a flat shape. */
  products?: RawAldiProduct[];
}

export async function fetchSearch(
  keyword: string,
  storeId: string,
  limit = 5,
): Promise<RawAldiProduct[]> {
  const url = new URL(`${baseUrl()}/v3/products/search`);
  url.searchParams.set('q', keyword);
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Aldi product search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawSearchResponse;
  return json.data?.products ?? json.products ?? [];
}
