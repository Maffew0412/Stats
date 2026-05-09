/**
 * Seed reference data: chains, departments, and a starter set of generic concepts.
 *
 * Seed data lives in src/lib/catalog/seeds.ts so it can be shared with the
 * client-side List Builder UI for offline autocomplete.
 *
 * `store_locations` is intentionally NOT seeded here — each chain's `external_id`
 * (the store number used by its site/API) is discovered when we wire up that
 * chain's scraper, so locations are inserted as part of per-chain bootstrapping.
 *
 * Idempotent: re-running this script will not duplicate rows. Conflicts on the
 * unique slug column are ignored.
 */

import 'dotenv/config';
import { db } from '../src/lib/db';
import {
  brandedProducts,
  chains,
  departments,
  genericConcepts,
} from '../src/lib/db/schema';
import {
  CHAIN_SEEDS,
  DEPARTMENT_SEEDS,
  GENERIC_CONCEPT_SEEDS,
} from '../src/lib/catalog/seeds';
import { BRANDED_PRODUCT_SEEDS } from '../src/lib/catalog/branded';

async function main() {
  console.log(`Seeding ${CHAIN_SEEDS.length} chains...`);
  await db.insert(chains).values([...CHAIN_SEEDS]).onConflictDoNothing({ target: chains.slug });

  console.log(`Seeding ${DEPARTMENT_SEEDS.length} departments...`);
  await db.insert(departments).values([...DEPARTMENT_SEEDS]).onConflictDoNothing({ target: departments.slug });

  const allDepartments = await db.select().from(departments);
  const departmentIdBySlug = new Map(allDepartments.map((d) => [d.slug, d.id]));

  console.log(`Seeding ${GENERIC_CONCEPT_SEEDS.length} generic concepts...`);
  const conceptRows = GENERIC_CONCEPT_SEEDS.map((gc) => {
    const departmentId = departmentIdBySlug.get(gc.departmentSlug);
    if (departmentId === undefined) {
      throw new Error(`Unknown department slug: ${gc.departmentSlug}`);
    }
    return {
      slug: gc.slug,
      name: gc.name,
      departmentId,
      attributes: gc.attributes,
      sizeValue: gc.sizeValue,
      sizeUnit: gc.sizeUnit,
      searchTerms: gc.searchTerms,
    };
  });
  await db.insert(genericConcepts).values(conceptRows).onConflictDoNothing({ target: genericConcepts.slug });

  console.log(`Seeding ${BRANDED_PRODUCT_SEEDS.length} branded products...`);
  const brandedRows = BRANDED_PRODUCT_SEEDS.map((bp) => {
    const departmentId = departmentIdBySlug.get(bp.departmentSlug);
    if (departmentId === undefined) {
      throw new Error(`Unknown department slug: ${bp.departmentSlug}`);
    }
    return {
      upc: bp.upc,
      name: bp.name,
      brand: bp.brand,
      sizeValue: bp.sizeValue,
      sizeUnit: bp.sizeUnit,
      departmentId,
      imageUrl: bp.imageUrl,
      searchTerms: bp.searchTerms,
      source: 'seed',
    };
  });
  await db
    .insert(brandedProducts)
    .values(brandedRows)
    .onConflictDoNothing({ target: brandedProducts.upc });

  console.log('Seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
