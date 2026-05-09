/**
 * Convert Target raw shapes into our internal NormalizedStore / NormalizedProduct.
 *
 * Defensive about missing fields — Target's nested response varies by endpoint
 * version and item type. Items that fail validation are dropped, not thrown.
 */

import type { NormalizedProduct, NormalizedStore } from '../types';
import type { RawNearbyStore, RawSearchItem } from './api';

const SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(oz|lb|gal|gallon|qt|fl\s*oz|ct|count|pk|pack|each|ea)\b/i;

export function normalizeStore(raw: RawNearbyStore): NormalizedStore | null {
  if (!raw.store_id || !raw.mailing_address?.address_line1) return null;
  return {
    externalId: raw.store_id,
    name: raw.location_name ?? `Target ${raw.store_id}`,
    address: raw.mailing_address.address_line1,
    city: raw.mailing_address.city ?? '',
    state: (raw.mailing_address.state ?? '').slice(0, 2).toUpperCase(),
    zip: raw.mailing_address.postal_code ?? '',
    lat: raw.geographic_specifications?.latitude,
    lng: raw.geographic_specifications?.longitude,
  };
}

export interface NormalizeProductOptions {
  /** Generic concept slug to attach to every product surfaced by this query. */
  matchedGenericConceptSlug: string;
  departmentSlug?: string;
}

export function normalizeProduct(
  raw: RawSearchItem,
  options: NormalizeProductOptions,
): NormalizedProduct | null {
  if (!raw.tcin) return null;

  const title =
    raw.item?.product_description?.title?.trim() ?? '';
  if (!title) return null;

  const regular = priceCents(raw.price?.reg_retail ?? raw.price?.current_retail);
  if (regular === null) return null;

  const sale =
    raw.price?.current_retail !== undefined &&
    raw.price?.reg_retail !== undefined &&
    raw.price.current_retail < raw.price.reg_retail
      ? priceCents(raw.price.current_retail)
      : null;

  const brand =
    raw.item?.primary_brand?.name ??
    raw.item?.product_description?.brand ??
    undefined;

  const { sizeValue, sizeUnit } = extractSize(title);
  const upc = extractUpc(raw);

  return {
    storeSku: raw.tcin,
    name: title,
    brand,
    upc,
    sizeValue,
    sizeUnit,
    departmentSlug: options.departmentSlug,
    imageUrl: raw.item?.enrichment?.images?.primary_image_url,
    matchedGenericConceptSlugs: [options.matchedGenericConceptSlug],
    price: {
      regularCents: regular,
      saleCents: sale ?? undefined,
    },
  };
}

/**
 * Picks the first UPC-shaped value from the locations Target's PLP response
 * has been observed to use. Returns undefined when none are present (very
 * common in PLP — UPC typically lives in the PDP detail).
 */
function extractUpc(raw: RawSearchItem): string | undefined {
  const candidates = [
    raw.item?.gtin13,
    raw.item?.gtin,
    raw.item?.upc,
    raw.item?.product_classification?.gtin,
  ];
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

function extractSize(title: string): { sizeValue?: string; sizeUnit?: string } {
  const m = title.match(SIZE_PATTERN);
  if (!m) return {};
  return {
    sizeValue: m[1],
    sizeUnit: normalizeUnit(m[2]),
  };
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
