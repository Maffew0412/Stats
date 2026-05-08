/**
 * Target scraper orchestrator.
 *
 * Live mode: locates the nearest Springfield Target via RedSky, then for each
 * seeded generic concept runs a Target search using the concept's primary
 * search term, taking the top N results and tagging them with that concept.
 *
 * Dry-run mode: loads representative captured/synthetic JSON from ./fixtures
 * and runs the same normalization + tagging pipeline. The two modes diverge
 * only at the I/O boundary; everything downstream is identical.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../../db';
import { genericConcepts, departments } from '../../db/schema';
import type { Scraper, ScraperContext, ScrapeResult } from '../types';
import {
  fetchNearbyStores,
  fetchSearch,
  type RawNearbyStore,
  type RawSearchItem,
} from './api';
import { normalizeProduct, normalizeStore } from './normalize';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const RESULTS_PER_CONCEPT = 5;
const REQUEST_DELAY_MS = 250;

/**
 * Concept used for the single dry-run fixture. Hardcoded so dry-run can
 * validate the full pipeline without a database connection.
 */
const DRY_RUN_CONCEPT: ConceptSeed = {
  slug: 'milk-2pct-gallon',
  searchTerms: ['milk', '2 percent', 'two percent milk', '2% milk'],
  departmentSlug: 'dairy',
};

export const targetScraper: Scraper = {
  key: 'target',
  async scrape(ctx: ScraperContext): Promise<ScrapeResult> {
    const store = await locateStore(ctx);
    if (!store) {
      throw new Error(`No Target store located near ${ctx.zip}`);
    }

    const concepts = await loadConcepts(ctx.dryRun);

    const products: ScrapeResult['products'] = [];
    for (const concept of concepts) {
      const term = concept.searchTerms?.[0];
      if (!term) continue;

      const items = await searchProducts(ctx, term, store.externalId);
      for (const raw of items) {
        const normalized = normalizeProduct(raw, {
          matchedGenericConceptSlug: concept.slug,
          departmentSlug: concept.departmentSlug,
        });
        if (normalized) products.push(normalized);
      }
      if (!ctx.dryRun) await sleep(REQUEST_DELAY_MS);
    }

    return { store, products };
  },
};

interface ConceptSeed {
  slug: string;
  searchTerms: string[];
  departmentSlug?: string;
}

async function loadConcepts(dryRun: boolean): Promise<ConceptSeed[]> {
  if (dryRun) {
    return [DRY_RUN_CONCEPT];
  }
  const allDepartments = await db.select().from(departments);
  const slugById = new Map(allDepartments.map((d) => [d.id, d.slug]));
  const rows = await db.select().from(genericConcepts);
  return rows.map((row) => ({
    slug: row.slug,
    searchTerms: row.searchTerms ?? [],
    departmentSlug:
      row.departmentId !== null && row.departmentId !== undefined
        ? slugById.get(row.departmentId)
        : undefined,
  }));
}

async function locateStore(ctx: ScraperContext) {
  const raw = ctx.dryRun
    ? await loadFixture<RawNearbyStore[]>('nearby-stores.json')
    : await fetchNearbyStores(ctx.zip, 5);
  for (const candidate of raw) {
    const normalized = normalizeStore(candidate);
    if (normalized) return normalized;
  }
  return null;
}

async function searchProducts(
  ctx: ScraperContext,
  keyword: string,
  storeExternalId: string,
): Promise<RawSearchItem[]> {
  if (ctx.dryRun) {
    return await loadFixture<RawSearchItem[]>('search.json');
  }
  return await fetchSearch(keyword, storeExternalId, RESULTS_PER_CONCEPT);
}

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), 'utf8');
  return JSON.parse(raw) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
