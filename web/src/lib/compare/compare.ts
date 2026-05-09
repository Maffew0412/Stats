/**
 * Comparison core: turns a user's list into per-store totals.
 *
 * This file is the IO layer — it loads chains, store locations, and price
 * lookups from the database, then hands them to the pure aggregator in
 * ./aggregate.ts. Anything algorithmically interesting lives there and is
 * tested without a DB.
 *
 * For MVP one location per chain is used (the first active location). When
 * we add user preferences for preferred locations per chain, this resolver
 * is the only thing that has to change.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  chains,
  currentPrices,
  genericConcepts,
  storeLocations,
  storeProductGenericMatch,
  storeProducts,
} from '../db/schema';
import {
  aggregateComparison,
  effectivePriceCents,
  type CheapestEntry,
  type ConceptLocationKey,
  type LocationRow,
  type UpcLocationKey,
} from './aggregate';
import type { CompareRequest, CompareResponse } from './types';

export async function compareList(input: CompareRequest): Promise<CompareResponse> {
  if (input.items.length === 0) {
    return { results: [], winnerChainSlug: null, savingsCents: 0 };
  }

  const targetChains = await resolveChains(input.selectedChainSlugs);
  const locationsByChain = await resolvePreferredLocations(targetChains.map((c) => c.id));

  const conceptSlugs = uniq(
    input.items
      .filter((it) => it.intent === 'generic' && it.conceptSlug)
      .map((it) => it.conceptSlug!),
  );
  const upcs = uniq(
    input.items
      .filter((it) => it.intent === 'branded' && it.upc)
      .map((it) => it.upc!),
  );
  const locationIds = [...locationsByChain.values()].map((l) => l.id);

  const cheapestGeneric = await loadCheapestGenericMatches(conceptSlugs, locationIds);
  const brandedMatches = await loadBrandedMatches(upcs, locationIds);

  return aggregateComparison({
    request: input,
    targetChains,
    locationsByChain,
    cheapestGeneric,
    brandedMatches,
  });
}

async function resolveChains(requestedSlugs?: string[]) {
  if (requestedSlugs && requestedSlugs.length > 0) {
    return await db
      .select()
      .from(chains)
      .where(inArray(chains.slug, requestedSlugs));
  }
  return await db.select().from(chains);
}

async function resolvePreferredLocations(chainIds: string[]) {
  if (chainIds.length === 0) return new Map<string, LocationRow>();
  const rows = await db
    .select()
    .from(storeLocations)
    .where(
      and(
        inArray(storeLocations.chainId, chainIds),
        eq(storeLocations.isActive, true),
      ),
    );
  // First location per chain (deterministic ordering by created_at then id).
  rows.sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  const out = new Map<string, LocationRow>();
  for (const row of rows) {
    if (!out.has(row.chainId)) {
      out.set(row.chainId, { id: row.id, name: row.name, address: row.address });
    }
  }
  return out;
}

async function loadCheapestGenericMatches(
  conceptSlugs: string[],
  locationIds: string[],
): Promise<Map<ConceptLocationKey, CheapestEntry>> {
  const out = new Map<ConceptLocationKey, CheapestEntry>();
  if (conceptSlugs.length === 0 || locationIds.length === 0) return out;

  const rows = await db
    .select({
      conceptSlug: genericConcepts.slug,
      storeLocationId: storeProducts.storeLocationId,
      storeProductId: storeProducts.id,
      storeSku: storeProducts.storeSku,
      name: storeProducts.name,
      brand: storeProducts.brand,
      sizeValue: storeProducts.sizeValue,
      sizeUnit: storeProducts.sizeUnit,
      imageUrl: storeProducts.imageUrl,
      regularCents: currentPrices.regularCents,
      saleCents: currentPrices.saleCents,
      saleEndsOn: currentPrices.saleEndsOn,
    })
    .from(genericConcepts)
    .innerJoin(
      storeProductGenericMatch,
      eq(storeProductGenericMatch.genericConceptId, genericConcepts.id),
    )
    .innerJoin(
      storeProducts,
      eq(storeProducts.id, storeProductGenericMatch.storeProductId),
    )
    .innerJoin(currentPrices, eq(currentPrices.storeProductId, storeProducts.id))
    .where(
      and(
        inArray(genericConcepts.slug, conceptSlugs),
        inArray(storeProducts.storeLocationId, locationIds),
      ),
    );

  for (const row of rows) {
    const key: ConceptLocationKey = `${row.conceptSlug}|${row.storeLocationId}`;
    const effective = effectivePriceCents(row.regularCents, row.saleCents);
    const incumbent = out.get(key);
    if (!incumbent) {
      out.set(key, asCheapestEntry(row));
      continue;
    }
    const incumbentEffective = effectivePriceCents(
      incumbent.regularCents,
      incumbent.saleCents,
    );
    if (effective < incumbentEffective) out.set(key, asCheapestEntry(row));
  }
  return out;
}

async function loadBrandedMatches(
  upcs: string[],
  locationIds: string[],
): Promise<Map<UpcLocationKey, CheapestEntry>> {
  const out = new Map<UpcLocationKey, CheapestEntry>();
  if (upcs.length === 0 || locationIds.length === 0) return out;

  const rows = await db
    .select({
      upc: storeProducts.upc,
      storeLocationId: storeProducts.storeLocationId,
      storeProductId: storeProducts.id,
      storeSku: storeProducts.storeSku,
      name: storeProducts.name,
      brand: storeProducts.brand,
      sizeValue: storeProducts.sizeValue,
      sizeUnit: storeProducts.sizeUnit,
      imageUrl: storeProducts.imageUrl,
      regularCents: currentPrices.regularCents,
      saleCents: currentPrices.saleCents,
      saleEndsOn: currentPrices.saleEndsOn,
    })
    .from(storeProducts)
    .innerJoin(currentPrices, eq(currentPrices.storeProductId, storeProducts.id))
    .where(
      and(
        inArray(storeProducts.upc, upcs),
        inArray(storeProducts.storeLocationId, locationIds),
      ),
    );

  for (const row of rows) {
    if (!row.upc) continue;
    const key: UpcLocationKey = `${row.upc}|${row.storeLocationId}`;
    out.set(key, asCheapestEntry(row));
  }
  return out;
}

function asCheapestEntry(row: {
  storeProductId: string;
  storeSku: string;
  name: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  imageUrl: string | null;
  regularCents: number;
  saleCents: number | null;
  saleEndsOn: string | null;
}): CheapestEntry {
  return {
    storeProductId: row.storeProductId,
    storeSku: row.storeSku,
    name: row.name,
    brand: row.brand,
    sizeValue: row.sizeValue,
    sizeUnit: row.sizeUnit,
    imageUrl: row.imageUrl,
    regularCents: row.regularCents,
    saleCents: row.saleCents,
    saleEndsOn: row.saleEndsOn,
  };
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
