/**
 * Shared scraper types.
 *
 * Every per-chain scraper module normalizes its source's responses into these
 * shapes. The store-agnostic ingest layer consumes them.
 */

export interface NormalizedStore {
  /** The chain's own store id (used by their site/API). */
  externalId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

export interface NormalizedPrice {
  regularCents: number;
  saleCents?: number;
  saleEndsOn?: string; // ISO date
}

export interface NormalizedProduct {
  /** Chain-internal product id. Stable across runs. */
  storeSku: string;
  name: string;
  brand?: string;
  upc?: string;
  sizeValue?: string;
  sizeUnit?: string;
  departmentSlug?: string;
  imageUrl?: string;
  /**
   * Generic concept slugs this product satisfies. The crosswalk row carries
   * the confidence — products surfaced via search-term match get 'auto'.
   */
  matchedGenericConceptSlugs: string[];
  price: NormalizedPrice;
}

export interface ScrapeResult {
  store: NormalizedStore;
  products: NormalizedProduct[];
}

export interface ScraperContext {
  /** ZIP for the store locator. */
  zip: string;
  /** When true, the scraper does no network I/O and pulls from fixtures. */
  dryRun: boolean;
  /**
   * The chain slug being scraped. For 1:1 scrapers (Target, Aldi) this equals
   * the scraper's own key. For multi-tenant scrapers (Rosie) this drives
   * tenant selection — Rosie hosts both County Market and Harvest Market.
   */
  chainSlug: string;
}

export interface Scraper {
  /** Stable identifier matching `chains.scraperKey`. */
  key: string;
  scrape(ctx: ScraperContext): Promise<ScrapeResult>;
}
