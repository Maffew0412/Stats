/**
 * Rosie scraper.
 *
 * One module, two chains. The orchestrator's ScraperContext carries the
 * chain slug; we resolve that to a Rosie tenant (host + storeSlug) for
 * URL construction. Fixtures are partitioned per chain so dry-runs
 * produce visibly distinct output for County Market vs Harvest Market.
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
  fetchSearch,
  fetchStore,
  type RawRosieProduct,
  type RawRosieStore,
} from './api';
import { normalizeProduct, normalizeStore } from './normalize';
import { tenantFor } from './tenants';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const RESULTS_PER_CONCEPT = 5;

const rosieRunner: ScraperRunner = {
  key: 'rosie',
  delayMs: 350,

  async locateStore(ctx: ScraperContext): Promise<NormalizedStore | null> {
    const tenant = tenantFor(ctx.chainSlug);
    const raw = ctx.dryRun
      ? await loadFixture<RawRosieStore>(ctx.chainSlug, 'store.json')
      : await fetchStore(tenant);
    if (!raw) return null;
    return normalizeStore(raw);
  },

  async searchForConcept(
    ctx: ScraperContext,
    concept: ConceptSeed,
    _store: NormalizedStore,
  ): Promise<NormalizedProduct[]> {
    const tenant = tenantFor(ctx.chainSlug);
    const term = concept.searchTerms[0];
    const items = ctx.dryRun
      ? await loadFixture<RawRosieProduct[]>(ctx.chainSlug, 'search.json')
      : await fetchSearch(tenant, term, RESULTS_PER_CONCEPT);

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

export const rosieScraper = buildScraper(rosieRunner);

async function loadFixture<T>(chainSlug: string, filename: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, chainSlug, filename), 'utf8');
  return JSON.parse(raw) as T;
}
