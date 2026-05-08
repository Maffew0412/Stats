/**
 * Aldi scraper.
 *
 * Live mode: locates the nearest Aldi pickup store, then for each seeded
 * generic concept runs a search and tags top results with that concept.
 *
 * Dry-run mode: loads representative captured/synthetic JSON from ./fixtures.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildScraper,
  type ConceptSeed,
  type ScraperRunner,
} from '../orchestrator';
import type { NormalizedProduct, NormalizedStore, ScraperContext } from '../types';
import {
  fetchNearbyStores,
  fetchSearch,
  type RawAldiProduct,
  type RawAldiStore,
} from './api';
import { normalizeProduct, normalizeStore } from './normalize';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const RESULTS_PER_CONCEPT = 5;

const aldiRunner: ScraperRunner = {
  key: 'aldi',
  delayMs: 400, // Be a touch politer; Aldi's storefront is more sensitive.

  async locateStore(ctx: ScraperContext): Promise<NormalizedStore | null> {
    const raw = ctx.dryRun
      ? await loadFixture<RawAldiStore[]>('nearby-stores.json')
      : await fetchNearbyStores(ctx.zip, 5);
    for (const candidate of raw) {
      const normalized = normalizeStore(candidate);
      if (normalized) return normalized;
    }
    return null;
  },

  async searchForConcept(
    ctx: ScraperContext,
    concept: ConceptSeed,
    store: NormalizedStore,
  ): Promise<NormalizedProduct[]> {
    const term = concept.searchTerms[0];
    const items = ctx.dryRun
      ? await loadFixture<RawAldiProduct[]>('search.json')
      : await fetchSearch(term, store.externalId, RESULTS_PER_CONCEPT);

    const out: NormalizedProduct[] = [];
    for (const raw of items) {
      const normalized = normalizeProduct(raw, {
        matchedGenericConceptSlug: concept.slug,
        departmentSlug: concept.departmentSlug,
      });
      if (normalized) out.push(normalized);
    }
    return out;
  },
};

export const aldiScraper = buildScraper(aldiRunner);

async function loadFixture<T>(filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, filename), 'utf8');
  return JSON.parse(raw) as T;
}
