/**
 * Pure helpers for normalizing Open Food Facts API responses.
 *
 * Extracted from scripts/import-off.ts so they can be unit-tested without
 * pulling in the CLI / DB-bearing module.
 */

export interface RawOffResponse {
  code?: string;
  status?: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    brands_tags?: string[];
    quantity?: string;
    image_url?: string;
    image_front_url?: string;
    categories_tags?: string[];
    categories?: string;
  };
}

export interface NormalizedOff {
  upc: string;
  name: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  imageUrl: string | null;
  /** OFF category tags we'll try to map onto our department slugs. */
  categoryTags: string[];
}

const QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz|lb|gal|gallon|qt|fl\s*oz|ct|count|pk|pack|each|ea)\b/i;

export function normalizeOff(raw: RawOffResponse): NormalizedOff | null {
  if (!raw.status || raw.status === 0) return null;
  const p = raw.product;
  if (!p) return null;
  const upc = p.code ?? raw.code;
  if (!upc) return null;
  const name = (p.product_name_en ?? p.product_name ?? '').trim();
  if (!name) return null;

  const brand = (p.brands?.split(',')[0] ?? '').trim() || null;
  const { value, unit } = parseQuantity(p.quantity);

  return {
    upc,
    name,
    brand,
    sizeValue: value,
    sizeUnit: unit,
    imageUrl: p.image_front_url ?? p.image_url ?? null,
    categoryTags: p.categories_tags ?? [],
  };
}

export function parseQuantity(qty: string | undefined): {
  value: string | null;
  unit: string | null;
} {
  if (!qty) return { value: null, unit: null };
  const m = qty.match(QUANTITY_PATTERN);
  if (!m) return { value: null, unit: null };
  return { value: m[1].replace(',', '.'), unit: normalizeUnit(m[2]) };
}

export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\s+/g, '');
  if (u === 'gallon') return 'gal';
  if (u === 'count') return 'ct';
  if (u === 'pack' || u === 'pk') return 'ct';
  if (u === 'each' || u === 'ea') return 'ea';
  if (u === 'floz') return 'fl oz';
  return u;
}

/**
 * Map OFF categories_tags to our department slugs. Best-effort; falls
 * back to null when nothing recognized.
 */
export function inferDepartmentFromOffTags(tags: string[]): string | null {
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t.includes('dairies') || t.includes('milk') || t.includes('cheese') || t.includes('yogurt') || t.includes('butter')) return 'dairy';
    if (t.includes('bread') || t.includes('bakery')) return 'bakery';
    if (t.includes('breakfast') || t.includes('cereals')) return 'breakfast';
    if (t.includes('beverages') || t.includes('drinks') || t.includes('juices') || t.includes('coffee') || t.includes('teas')) return 'beverages';
    if (t.includes('frozen')) return 'frozen';
    if (t.includes('meat') || t.includes('poultry')) return 'meat';
    if (t.includes('fish') || t.includes('seafood')) return 'seafood';
    if (t.includes('snack')) return 'snacks';
    if (t.includes('produce') || t.includes('fruits') || t.includes('vegetables')) return 'produce';
    if (t.includes('cleaning') || t.includes('detergent')) return 'household';
    if (t.includes('baby')) return 'baby';
    if (t.includes('personal-care') || t.includes('hygiene')) return 'personal-care';
  }
  return null;
}

export function brandSearchTerms(n: NormalizedOff): string[] {
  const terms = new Set<string>();
  if (n.brand) terms.add(n.brand.toLowerCase());
  for (const word of n.name.toLowerCase().split(/\s+/)) {
    if (word.length >= 3) terms.add(word);
  }
  return Array.from(terms);
}
