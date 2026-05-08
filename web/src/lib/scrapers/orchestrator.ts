/**
 * Shared scraper orchestrator.
 *
 * Each per-chain scraper provides a `ScraperRunner` with two operations:
 *  - locateStore(ctx): pick the right store_location for the user's ZIP
 *  - searchForConcept(ctx, concept, store): return normalized products matching
 *    the concept at that store
 *
 * This module loops the user's seeded concepts (or a single concept in
 * dry-run), invokes the runner for each, and assembles a ScrapeResult.
 *
 * Per-runner specifics (Target's RedSky vs Aldi's pickup catalog vs Rosie)
 * stay in their own modules; only the request shape differs. Anything common
 * (concept loading, throttle, fixture-mode wiring) lives here.
 */

import { db } from '../db';
import { departments, genericConcepts } from '../db/schema';
import type {
  NormalizedProduct,
  NormalizedStore,
  Scraper,
  ScraperContext,
  ScrapeResult,
} from './types';

export interface ConceptSeed {
  slug: string;
  searchTerms: string[];
  departmentSlug?: string;
}

export interface ScraperRunner {
  /** Stable identifier matching `chains.scraperKey`. */
  key: string;
  locateStore(ctx: ScraperContext): Promise<NormalizedStore | null>;
  searchForConcept(
    ctx: ScraperContext,
    concept: ConceptSeed,
    store: NormalizedStore,
  ): Promise<NormalizedProduct[]>;
  /** Inter-request delay in ms during live runs. Defaults to 250. */
  delayMs?: number;
}

/**
 * Shared dry-run concept used to drive offline pipeline tests. Every scraper
 * provides a fixture matching this concept (typically a single representative
 * search response).
 */
export const DRY_RUN_CONCEPT: ConceptSeed = {
  slug: 'milk-2pct-gallon',
  searchTerms: ['milk', '2 percent', 'two percent milk', '2% milk'],
  departmentSlug: 'dairy',
};

export function buildScraper(runner: ScraperRunner): Scraper {
  return {
    key: runner.key,
    async scrape(ctx: ScraperContext): Promise<ScrapeResult> {
      const store = await runner.locateStore(ctx);
      if (!store) {
        throw new Error(`No ${runner.key} store located near ${ctx.zip}`);
      }

      const concepts = await loadConcepts(ctx.dryRun);

      const products: NormalizedProduct[] = [];
      for (const concept of concepts) {
        if (concept.searchTerms.length === 0) continue;
        const found = await runner.searchForConcept(ctx, concept, store);
        products.push(...found);
        if (!ctx.dryRun) await sleep(runner.delayMs ?? 250);
      }
      return { store, products };
    },
  };
}

export async function loadConcepts(dryRun: boolean): Promise<ConceptSeed[]> {
  if (dryRun) return [DRY_RUN_CONCEPT];
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
