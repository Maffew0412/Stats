/**
 * Aldi raw shapes → internal NormalizedStore / NormalizedProduct.
 *
 * Defensive about missing fields. Aldi has no native sale-price model in the
 * catalog (weekly-ad specials live separately and are not ingested yet), so
 * `price.saleCents` stays undefined here.
 */

import type { NormalizedProduct, NormalizedStore } from '../types';
import type { RawAldiProduct, RawAldiStore } from './api';

const SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(oz|lb|gal|gallon|qt|fl\s*oz|ct|count|pk|pack|each|ea)\b/i;

export function normalizeStore(raw: RawAldiStore): NormalizedStore | null {
  if (!raw.storeId || !raw.address?.line1) return null;
  return {
    externalId: raw.storeId,
    name: raw.name ?? `Aldi ${raw.storeId}`,
    address: raw.address.line1,
    city: raw.address.city ?? '',
    state: (raw.address.state ?? '').slice(0, 2).toUpperCase(),
    zip: raw.address.postalCode ?? '',
    lat: raw.geo?.latitude,
    lng: raw.geo?.longitude,
  };
}

export interface NormalizeProductOptions {
  matchedGenericConceptSlug: string;
  departmentSlug?: string;
}

export function normalizeProduct(
  raw: RawAldiProduct,
  options: NormalizeProductOptions,
): NormalizedProduct | null {
  const sku = raw.sku ?? raw.productId;
  if (!sku) return null;

  const name = raw.name?.trim();
  if (!name) return null;

  const dollars = raw.price?.value ?? raw.price?.amount;
  const regularCents = priceCents(dollars);
  if (regularCents === null) return null;

  const { sizeValue, sizeUnit } = resolveSize(raw, name);
  const upc = extractUpc(raw);

  return {
    storeSku: sku,
    name,
    brand: raw.brand,
    upc,
    sizeValue,
    sizeUnit,
    departmentSlug: options.departmentSlug,
    imageUrl: raw.imageUrl,
    matchedGenericConceptSlugs: [options.matchedGenericConceptSlug],
    price: {
      regularCents,
    },
  };
}

/**
 * Extract a UPC-shaped value from the locations Aldi has been observed to use.
 * Returns undefined when none are present (the storefront doesn't expose UPCs
 * for every item; Aldi private-label SKUs in particular often surface only
 * Aldi's internal SKU, not a GS1 UPC).
 */
function extractUpc(raw: RawAldiProduct): string | undefined {
  const candidates: (string | undefined)[] = [raw.upc, raw.gtin, raw.barcodes?.[0]];
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{12,14}$/.test(c.trim())) {
      return c.trim();
    }
  }
  return undefined;
}

function priceCents(dollars: number | undefined): number | null {
  if (dollars === undefined || Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

function resolveSize(
  raw: RawAldiProduct,
  fallbackTitle: string,
): { sizeValue?: string; sizeUnit?: string } {
  if (raw.size?.value !== undefined && raw.size.unit) {
    return {
      sizeValue: String(raw.size.value),
      sizeUnit: normalizeUnit(raw.size.unit),
    };
  }
  const m = fallbackTitle.match(SIZE_PATTERN);
  if (!m) return {};
  return { sizeValue: m[1], sizeUnit: normalizeUnit(m[2]) };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\s+/g, '');
  if (u === 'gallon') return 'gal';
  if (u === 'count') return 'ct';
  if (u === 'pack' || u === 'pk') return 'ct';
  if (u === 'each' || u === 'ea') return 'ea';
  if (u === 'floz') return 'fl oz';
  return u;
}
