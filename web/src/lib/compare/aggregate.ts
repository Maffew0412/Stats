/**
 * Pure aggregation for the comparison core.
 *
 * Takes pre-loaded chains, store locations, and price-lookup maps, and
 * computes the per-store totals, sort order, winner, and savings. Has no
 * dependency on the DB — `compare.ts` is the IO wrapper that loads the
 * inputs and hands them to `aggregateComparison`.
 */

import type {
  ChosenProduct,
  CompareItemResult,
  CompareRequest,
  CompareResponse,
  StoreComparison,
} from './types';

export interface ChainRow {
  id: string;
  slug: string;
  name: string;
}

export interface LocationRow {
  id: string;
  name: string;
  address: string;
}

export interface CheapestEntry {
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

export type ConceptLocationKey = `${string}|${string}`;
export type UpcLocationKey = `${string}|${string}`;

export interface AggregateInputs {
  request: CompareRequest;
  targetChains: ChainRow[];
  locationsByChain: Map<string, LocationRow>;
  cheapestGeneric: Map<ConceptLocationKey, CheapestEntry>;
  brandedMatches: Map<UpcLocationKey, CheapestEntry>;
}

export function aggregateComparison(inputs: AggregateInputs): CompareResponse {
  const { request, targetChains, locationsByChain, cheapestGeneric, brandedMatches } = inputs;

  if (request.items.length === 0) {
    return { results: [], winnerChainSlug: null, savingsCents: 0 };
  }

  const results: StoreComparison[] = targetChains
    .map((chain): StoreComparison | null => {
      const location = locationsByChain.get(chain.id);
      if (!location) return null;

      const itemResults: CompareItemResult[] = request.items.map((item) =>
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

export function evaluateItem(
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
      departmentSlug: item.departmentSlug,
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
    departmentSlug: item.departmentSlug,
  };
}

export function effectivePriceCents(regular: number, sale: number | null): number {
  return sale !== null && sale < regular ? sale : regular;
}
