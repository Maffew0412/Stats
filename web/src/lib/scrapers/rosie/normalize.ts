/**
 * Rosie raw shapes → internal NormalizedStore / NormalizedProduct.
 *
 * Rosie's `size` field is a free-text string (e.g., "1 gal", "16 oz",
 * "12 ct"), so we parse it the same way we parse Target/Aldi titles. UPCs
 * are sometimes present and pass through directly.
 */

import type { NormalizedProduct, NormalizedStore } from '../types';
import type { RawRosieProduct, RawRosieStore } from './api';

const SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(oz|lb|gal|gallon|qt|fl\s*oz|ct|count|pk|pack|each|ea)\b/i;

export function normalizeStore(raw: RawRosieStore): NormalizedStore | null {
  if (!raw.id || !raw.address?.streetAddress) return null;
  return {
    externalId: raw.id,
    name: raw.name ?? `Rosie ${raw.id}`,
    address: raw.address.streetAddress,
    city: raw.address.addressLocality ?? '',
    state: (raw.address.addressRegion ?? '').slice(0, 2).toUpperCase(),
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
  raw: RawRosieProduct,
  options: NormalizeProductOptions,
): NormalizedProduct | null {
  const sku = raw.id ?? raw.productId;
  if (!sku) return null;

  const name = raw.name?.trim();
  if (!name) return null;

  const regularCents = priceCents(raw.price);
  if (regularCents === null) return null;

  const saleCents = priceCents(raw.salePrice);
  const sale =
    saleCents !== null && saleCents < regularCents ? saleCents : undefined;

  const { sizeValue, sizeUnit } = parseSize(raw.size, name);

  return {
    storeSku: sku,
    name,
    brand: raw.brand,
    upc: raw.upc,
    sizeValue,
    sizeUnit,
    departmentSlug: options.departmentSlug,
    imageUrl: raw.imageUrl,
    matchedGenericConceptSlugs: [options.matchedGenericConceptSlug],
    price: {
      regularCents,
      saleCents: sale,
      saleEndsOn: sale !== undefined ? raw.saleEndsOn : undefined,
    },
  };
}

function priceCents(dollars: number | undefined): number | null {
  if (dollars === undefined || Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

function parseSize(
  size: string | undefined,
  fallbackTitle: string,
): { sizeValue?: string; sizeUnit?: string } {
  const candidates = [size, fallbackTitle].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
  for (const candidate of candidates) {
    const m = candidate.match(SIZE_PATTERN);
    if (m) return { sizeValue: m[1], sizeUnit: normalizeUnit(m[2]) };
  }
  return {};
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
