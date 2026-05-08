/**
 * Comparison core: turns a user's list into per-store totals.
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
import type {
  ChosenProduct,
  CompareItemResult,
  CompareRequest,
  CompareResponse,
  StoreComparison,
} from './types';

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

  const results: StoreComparison[] = targetChains
    .map((chain): StoreComparison | null => {
      const location = locationsByChain.get(chain.id);
      if (!location) return null;

      const itemResults: CompareItemResult[] = input.items.map((item) =>
        evaluateItem(item, location.id, cheapestGeneric, brandedMatches),
      );

      const totalCents = itemResults.reduce((sum, r) => sum + r.lineTotalCents, 0);
      const matchedCount = itemResults.filter((r) => r.status === 'matched').length;
      const unavailableCount = itemResults.length - matchedCount;
      const onSaleCount = itemResults.filter(
        (r) => r.chosenProduct?.saleCents !== null && r.chosenProduct?.saleCents !== undefined,
      ).length;

      return {
        chainSlug: chain.slug,
        chainName: chain.name,
        storeLocationId: location.id,
        storeLocationName: location.name,
        storeLocationAddress: location.address,
        totalCents,
        matchedCount,
        unavailableCount,
        onSaleCount,
        items: itemResults,
      };
    })
    .filter((r): r is StoreComparison => r !== null)
    .sort((a, b) => {
      // Stores with at least one matched item rank ahead of empty ones,
      // then by total ascending, then by name as a tiebreaker.
      if (a.matchedCount > 0 && b.matchedCount === 0) return -1;
      if (a.matchedCount === 0 && b.matchedCount > 0) return 1;
      if (a.totalCents !== b.totalCents) return a.totalCents - b.totalCents;
      return a.chainName.localeCompare(b.chainName);
    });

  const matchedResults = results.filter((r) => r.matchedCount > 0);
  const winnerChainSlug = matchedResults[0]?.chainSlug ?? null;
  const savingsCents =
    matchedResults.length >= 2
      ? matchedResults[1].totalCents - matchedResults[0].totalCents
      : 0;

  return { results, winnerChainSlug, savingsCents };
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
  if (chainIds.length === 0) return new Map<string, typeof storeLocations.$inferSelect>();
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
  const out = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!out.has(row.chainId)) out.set(row.chainId, row);
  }
  return out;
}

interface CheapestEntry {
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
}

type ConceptLocationKey = `${string}|${string}`;
type UpcLocationKey = `${string}|${string}`;

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

function evaluateItem(
  item: CompareRequest['items'][number],
  storeLocationId: string,
  cheapestGeneric: Map<ConceptLocationKey, CheapestEntry>,
  brandedMatches: Map<UpcLocationKey, CheapestEntry>,
): CompareItemResult {
  let entry: CheapestEntry | undefined;
  if (item.intent === 'generic' && item.conceptSlug) {
    entry = cheapestGeneric.get(`${item.conceptSlug}|${storeLocationId}`);
  } else if (item.intent === 'branded' && item.upc) {
    entry = brandedMatches.get(`${item.upc}|${storeLocationId}`);
  }

  if (!entry) {
    return {
      rawQuery: item.rawQuery,
      displayName: item.displayName,
      quantity: item.quantity,
      status: 'unavailable',
      chosenProduct: null,
      lineTotalCents: 0,
    };
  }

  const unitPriceCents = effectivePriceCents(entry.regularCents, entry.saleCents);
  const chosenProduct: ChosenProduct = {
    storeProductId: entry.storeProductId,
    storeSku: entry.storeSku,
    name: entry.name,
    brand: entry.brand,
    sizeValue: entry.sizeValue,
    sizeUnit: entry.sizeUnit,
    imageUrl: entry.imageUrl,
    unitPriceCents,
    regularCents: entry.regularCents,
    saleCents: entry.saleCents,
    saleEndsOn: entry.saleEndsOn,
  };

  return {
    rawQuery: item.rawQuery,
    displayName: item.displayName,
    quantity: item.quantity,
    status: 'matched',
    chosenProduct,
    lineTotalCents: unitPriceCents * item.quantity,
  };
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

function effectivePriceCents(regular: number, sale: number | null): number {
  return sale !== null && sale < regular ? sale : regular;
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
