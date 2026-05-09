/**
 * Open Food Facts importer.
 *
 * Fetches one product per UPC from world.openfoodfacts.org and upserts it
 * into the `branded_products` table. Either seeds new UPCs or refreshes
 * existing rows with up-to-date OFF data (overwriting the synthetic UPCs
 * shipped in src/lib/catalog/branded.ts once you have real ones).
 *
 * Usage:
 *   pnpm import-off <upc> [<upc>...]      # live: fetches each UPC from OFF
 *   pnpm import-off --dry-run --print     # offline: load fixture, print
 *                                         # the row that would be upserted
 *   pnpm import-off --from-seeds          # use UPCs from BRANDED_PRODUCT_SEEDS
 *
 * OFF is licensed under ODbL (data) / CC-BY-SA (images). Attribution and
 * the share-alike provisions apply; see https://world.openfoodfacts.org/.
 *
 * Schema (https://wiki.openfoodfacts.org/API):
 *   GET /api/v2/product/{barcode}.json
 *   { code, status, status_verbose, product: { product_name, brands,
 *     quantity, image_url, categories_tags, ... } }
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../src/lib/db';
import { brandedProducts, departments } from '../src/lib/db/schema';
import { BRANDED_PRODUCT_SEEDS } from '../src/lib/catalog/branded';
import { eq, sql } from 'drizzle-orm';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'off');
const OFF_BASE = 'https://world.openfoodfacts.org';
const REQUEST_DELAY_MS = 350;

interface Args {
  upcs: string[];
  dryRun: boolean;
  printOnly: boolean;
  fromSeeds: boolean;
}

interface RawOffResponse {
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

interface NormalizedOff {
  upc: string;
  name: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  imageUrl: string | null;
  /** OFF category labels we'll try to map onto our department slugs. */
  categoryTags: string[];
}

const QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz|lb|gal|gallon|qt|fl\s*oz|ct|count|pk|pack|each|ea)\b/i;

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      flags.set(k, v ?? 'true');
    } else {
      positional.push(a);
    }
  }
  return {
    upcs: positional,
    dryRun: flags.get('dry-run') === 'true',
    printOnly: flags.get('print') === 'true',
    fromSeeds: flags.get('from-seeds') === 'true',
  };
}

async function fetchOff(upc: string): Promise<RawOffResponse> {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(upc)}.json`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'grocery-mvp/0.1 (+contact: TBD)',
    },
  });
  if (!res.ok) {
    throw new Error(`OFF ${res.status} for ${upc}: ${await res.text()}`);
  }
  return (await res.json()) as RawOffResponse;
}

async function loadFixture(upc: string): Promise<RawOffResponse> {
  const raw = await readFile(join(FIXTURES_DIR, `${upc}.json`), 'utf8');
  return JSON.parse(raw) as RawOffResponse;
}

function normalize(raw: RawOffResponse): NormalizedOff | null {
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

function parseQuantity(qty: string | undefined): {
  value: string | null;
  unit: string | null;
} {
  if (!qty) return { value: null, unit: null };
  const m = qty.match(QUANTITY_PATTERN);
  if (!m) return { value: null, unit: null };
  return { value: m[1].replace(',', '.'), unit: normalizeUnit(m[2]) };
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

/**
 * Map OFF categories_tags to our department slugs. Best-effort; falls
 * back to leaving department_id NULL when we don't recognize anything.
 */
function inferDepartment(tags: string[]): string | null {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let upcs = args.upcs;
  if (args.fromSeeds) upcs = BRANDED_PRODUCT_SEEDS.map((s) => s.upc);
  if (upcs.length === 0) {
    console.error(
      'Usage: pnpm import-off <upc> [<upc>...] [--dry-run] [--print] [--from-seeds]',
    );
    process.exit(2);
  }

  // Resolve department slugs once.
  let departmentIdBySlug = new Map<string, number>();
  if (!args.printOnly) {
    const rows = await db.select().from(departments);
    departmentIdBySlug = new Map(rows.map((d) => [d.slug, d.id]));
  }

  console.log(
    `Importing ${upcs.length} UPC${upcs.length === 1 ? '' : 's'} from OFF (dryRun=${args.dryRun}, printOnly=${args.printOnly})`,
  );

  let upserted = 0;
  let missing = 0;
  let failed = 0;
  for (const upc of upcs) {
    try {
      const raw = args.dryRun ? await loadFixture(upc) : await fetchOff(upc);
      const norm = normalize(raw);
      if (!norm) {
        console.log(`  ${upc} → not found`);
        missing += 1;
        continue;
      }
      const departmentSlug = inferDepartment(norm.categoryTags);
      const departmentId = departmentSlug
        ? departmentIdBySlug.get(departmentSlug) ?? null
        : null;

      const row = {
        upc: norm.upc,
        name: norm.name,
        brand: norm.brand,
        sizeValue: norm.sizeValue,
        sizeUnit: norm.sizeUnit,
        departmentId,
        imageUrl: norm.imageUrl,
        searchTerms: brandSearchTerms(norm),
        source: 'open-food-facts',
      };

      if (args.printOnly) {
        console.log(`  ${upc} →`, row);
      } else {
        await db
          .insert(brandedProducts)
          .values(row)
          .onConflictDoUpdate({
            target: brandedProducts.upc,
            set: {
              name: row.name,
              brand: row.brand,
              sizeValue: row.sizeValue,
              sizeUnit: row.sizeUnit,
              departmentId: row.departmentId,
              imageUrl: row.imageUrl,
              searchTerms: row.searchTerms,
              source: row.source,
              updatedAt: sql`now()`,
            },
            setWhere: eq(brandedProducts.upc, row.upc),
          });
        console.log(`  ${upc} → upserted (${row.brand ?? '?'} ${row.name})`);
      }
      upserted += 1;
      if (!args.dryRun) await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      failed += 1;
      console.error(`  ${upc} → FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `Done. ${upserted} upserted, ${missing} not found, ${failed} failed.`,
  );
}

function brandSearchTerms(n: NormalizedOff): string[] {
  const terms = new Set<string>();
  if (n.brand) terms.add(n.brand.toLowerCase());
  for (const word of n.name.toLowerCase().split(/\s+/)) {
    if (word.length >= 3) terms.add(word);
  }
  return Array.from(terms);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
