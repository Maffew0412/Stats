/**
 * Target RedSky API client.
 *
 * IMPORTANT — verification needed before live use:
 * Target's RedSky endpoints and the public web `key` parameter are not a
 * stable public API. Both the URL paths and the key value have changed over
 * time and must be verified against Target's current web bundle before this
 * scraper can be trusted in production. Capture a real response with
 * `pnpm scrape target --capture` (TODO) and diff against the shapes consumed
 * by `normalize.ts`.
 *
 * The default key below is the long-standing value shipped in target.com's
 * web bundle and was valid at time of writing. If responses come back as
 * 401/403, refresh it from the latest bundle.
 */

const DEFAULT_API_KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
const REDSKY_BASE = 'https://redsky.target.com';

function apiKey(): string {
  return process.env.TARGET_REDSKY_KEY ?? DEFAULT_API_KEY;
}

export interface RawNearbyStore {
  store_id: string;
  location_name?: string;
  mailing_address?: {
    address_line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  geographic_specifications?: {
    latitude?: number;
    longitude?: number;
  };
}

export async function fetchNearbyStores(zip: string, limit = 5): Promise<RawNearbyStore[]> {
  const url = new URL(`${REDSKY_BASE}/v3/stores/nearby/${encodeURIComponent(zip)}`);
  url.searchParams.set('key', apiKey());
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('within', '50');

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Target nearby_stores ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as Array<{ stores?: RawNearbyStore[] }>;
  return json[0]?.stores ?? [];
}

/**
 * Raw search response shape. Target nests deeply and the path has shifted
 * across versions; the normalizer is defensive about missing fields.
 */
export interface RawSearchResponse {
  data?: {
    search?: {
      search_response?: {
        items?: {
          Item?: RawSearchItem[];
        };
      };
    };
  };
}

export interface RawSearchItem {
  tcin?: string;
  item?: {
    product_description?: {
      title?: string;
      brand?: string;
    };
    enrichment?: {
      images?: { primary_image_url?: string };
    };
    primary_brand?: { name?: string };
  };
  price?: {
    current_retail?: number;
    reg_retail?: number;
    formatted_current_price?: string;
    is_current_price_range?: boolean;
  };
}

export async function fetchSearch(
  keyword: string,
  pricingStoreId: string,
  limit = 5,
): Promise<RawSearchItem[]> {
  const url = new URL(`${REDSKY_BASE}/redsky_aggregations/v1/web/plp_search_v2`);
  url.searchParams.set('key', apiKey());
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('channel', 'WEB');
  url.searchParams.set('count', String(limit));
  url.searchParams.set('pricing_store_id', pricingStoreId);
  url.searchParams.set('store_ids', pricingStoreId);
  url.searchParams.set('visitor_id', '0000');
  url.searchParams.set('page', `/s/${encodeURIComponent(keyword)}`);

  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`Target plp_search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawSearchResponse;
  return json.data?.search?.search_response?.items?.Item ?? [];
}
