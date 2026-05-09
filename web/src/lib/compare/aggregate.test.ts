import { describe, expect, it } from 'vitest';
import {
  aggregateComparison,
  effectivePriceCents,
  evaluateItem,
  type CheapestEntry,
  type ConceptLocationKey,
  type UpcLocationKey,
  type ChainRow,
  type LocationRow,
} from './aggregate';
import type { CompareRequestItem } from './types';

function entry(overrides: Partial<CheapestEntry> = {}): CheapestEntry {
  return {
    storeProductId: 'sp-1',
    storeSku: 'sku-1',
    name: '2% Milk',
    brand: 'Acme',
    sizeValue: '1',
    sizeUnit: 'gal',
    imageUrl: null,
    regularCents: 399,
    saleCents: null,
    saleEndsOn: null,
    ...overrides,
  };
}

function genericItem(overrides: Partial<CompareRequestItem> = {}): CompareRequestItem {
  return {
    intent: 'generic',
    conceptSlug: 'milk-2pct-gallon',
    rawQuery: 'milk',
    displayName: '2% milk, 1 gallon',
    quantity: 1,
    departmentSlug: 'dairy',
    ...overrides,
  };
}

function brandedItem(overrides: Partial<CompareRequestItem> = {}): CompareRequestItem {
  return {
    intent: 'branded',
    upc: '0099000000006',
    rawQuery: 'heinz',
    displayName: 'Heinz Tomato Ketchup',
    quantity: 1,
    departmentSlug: 'pantry',
    ...overrides,
  };
}

const aldi: ChainRow = { id: 'chain-aldi', slug: 'aldi', name: 'Aldi' };
const target: ChainRow = { id: 'chain-target', slug: 'target', name: 'Target' };
const schnucks: ChainRow = { id: 'chain-schnucks', slug: 'schnucks', name: 'Schnucks' };

const locAldi: LocationRow = { id: 'loc-aldi', name: 'Aldi - Stevenson', address: '2300 Stevenson Dr' };
const locTarget: LocationRow = { id: 'loc-target', name: 'Target - Wabash', address: '2125 Wabash Ave' };
const locSchnucks: LocationRow = { id: 'loc-schnucks', name: 'Schnucks - Monroe', address: '1903 W Monroe St' };

describe('effectivePriceCents', () => {
  it('returns regular when no sale', () => {
    expect(effectivePriceCents(399, null)).toBe(399);
  });
  it('returns sale when cheaper', () => {
    expect(effectivePriceCents(399, 299)).toBe(299);
  });
  it('returns regular when sale equals regular', () => {
    expect(effectivePriceCents(399, 399)).toBe(399);
  });
  it('ignores sale that is more expensive than regular', () => {
    expect(effectivePriceCents(399, 499)).toBe(399);
  });
});

describe('evaluateItem', () => {
  const cheapestGeneric = new Map<ConceptLocationKey, CheapestEntry>([
    ['milk-2pct-gallon|loc-aldi', entry({ regularCents: 279 })],
  ]);
  const brandedMatches = new Map<UpcLocationKey, CheapestEntry>([
    ['0099000000006|loc-target', entry({ regularCents: 459, saleCents: 359, saleEndsOn: '2026-05-15' })],
  ]);

  it('matches a generic item by concept+location', () => {
    const r = evaluateItem(genericItem({ quantity: 2 }), 'loc-aldi', cheapestGeneric, brandedMatches);
    expect(r.status).toBe('matched');
    expect(r.chosenProduct?.unitPriceCents).toBe(279);
    expect(r.lineTotalCents).toBe(558);
    expect(r.departmentSlug).toBe('dairy');
  });

  it('returns unavailable when no concept match at the given location', () => {
    const r = evaluateItem(genericItem(), 'loc-target', cheapestGeneric, brandedMatches);
    expect(r.status).toBe('unavailable');
    expect(r.chosenProduct).toBeNull();
    expect(r.lineTotalCents).toBe(0);
    expect(r.departmentSlug).toBe('dairy');
  });

  it('matches a branded item by upc+location and applies the sale', () => {
    const r = evaluateItem(brandedItem({ quantity: 3 }), 'loc-target', cheapestGeneric, brandedMatches);
    expect(r.status).toBe('matched');
    expect(r.chosenProduct?.unitPriceCents).toBe(359);
    expect(r.chosenProduct?.regularCents).toBe(459);
    expect(r.chosenProduct?.saleCents).toBe(359);
    expect(r.lineTotalCents).toBe(1077);
  });

  it('returns unavailable when generic intent has no conceptSlug', () => {
    const r = evaluateItem(
      { ...genericItem(), conceptSlug: undefined },
      'loc-aldi',
      cheapestGeneric,
      brandedMatches,
    );
    expect(r.status).toBe('unavailable');
  });
});

describe('aggregateComparison', () => {
  it('returns empty result for an empty list', () => {
    const out = aggregateComparison({
      request: { items: [] },
      targetChains: [aldi],
      locationsByChain: new Map([[aldi.id, locAldi]]),
      cheapestGeneric: new Map(),
      brandedMatches: new Map(),
    });
    expect(out.results).toEqual([]);
    expect(out.winnerChainSlug).toBeNull();
    expect(out.savingsCents).toBe(0);
  });

  it('skips chains that have no resolved location', () => {
    const out = aggregateComparison({
      request: { items: [genericItem()] },
      targetChains: [aldi, target],
      locationsByChain: new Map([[aldi.id, locAldi]]), // target intentionally missing
      cheapestGeneric: new Map([['milk-2pct-gallon|loc-aldi', entry({ regularCents: 279 })]]),
      brandedMatches: new Map(),
    });
    expect(out.results.map((r) => r.chainSlug)).toEqual(['aldi']);
  });

  it('picks the cheapest matching store as winner and computes savings vs next-best', () => {
    const milkAtAldi = entry({ storeProductId: 'sp-aldi', regularCents: 279 });
    const milkAtTarget = entry({ storeProductId: 'sp-target', regularCents: 349 });
    const milkAtSchnucks = entry({ storeProductId: 'sp-schnucks', regularCents: 419 });

    const out = aggregateComparison({
      request: { items: [genericItem({ quantity: 2 })] },
      targetChains: [target, schnucks, aldi],
      locationsByChain: new Map([
        [aldi.id, locAldi],
        [target.id, locTarget],
        [schnucks.id, locSchnucks],
      ]),
      cheapestGeneric: new Map([
        ['milk-2pct-gallon|loc-aldi', milkAtAldi],
        ['milk-2pct-gallon|loc-target', milkAtTarget],
        ['milk-2pct-gallon|loc-schnucks', milkAtSchnucks],
      ]),
      brandedMatches: new Map(),
    });

    expect(out.results.map((r) => r.chainSlug)).toEqual(['aldi', 'target', 'schnucks']);
    expect(out.winnerChainSlug).toBe('aldi');
    expect(out.savingsCents).toBe(349 * 2 - 279 * 2);
  });

  it('zero savings when only one store has matches', () => {
    const out = aggregateComparison({
      request: { items: [genericItem()] },
      targetChains: [aldi, target],
      locationsByChain: new Map([
        [aldi.id, locAldi],
        [target.id, locTarget],
      ]),
      cheapestGeneric: new Map([['milk-2pct-gallon|loc-aldi', entry({ regularCents: 279 })]]),
      brandedMatches: new Map(),
    });
    expect(out.winnerChainSlug).toBe('aldi');
    expect(out.savingsCents).toBe(0);
    // Stores without matches still appear in results, but ranked last.
    const matched = out.results.filter((r) => r.matchedCount > 0);
    const empty = out.results.filter((r) => r.matchedCount === 0);
    expect(matched[0].chainSlug).toBe('aldi');
    expect(empty[0].chainSlug).toBe('target');
  });

  it('winner is null when no store has any match', () => {
    const out = aggregateComparison({
      request: { items: [genericItem()] },
      targetChains: [aldi],
      locationsByChain: new Map([[aldi.id, locAldi]]),
      cheapestGeneric: new Map(),
      brandedMatches: new Map(),
    });
    expect(out.winnerChainSlug).toBeNull();
    expect(out.results[0].matchedCount).toBe(0);
    expect(out.results[0].unavailableCount).toBe(1);
    expect(out.results[0].totalCents).toBe(0);
  });

  it('counts on-sale items per store', () => {
    const out = aggregateComparison({
      request: { items: [genericItem(), brandedItem()] },
      targetChains: [target],
      locationsByChain: new Map([[target.id, locTarget]]),
      cheapestGeneric: new Map([
        ['milk-2pct-gallon|loc-target', entry({ regularCents: 399, saleCents: 299 })],
      ]),
      brandedMatches: new Map([
        ['0099000000006|loc-target', entry({ regularCents: 459, saleCents: null })],
      ]),
    });
    expect(out.results[0].onSaleCount).toBe(1);
    expect(out.results[0].matchedCount).toBe(2);
  });

  it('breaks ties on total by chain name', () => {
    const sameCents = entry({ regularCents: 399 });
    const out = aggregateComparison({
      request: { items: [genericItem()] },
      targetChains: [target, aldi],
      locationsByChain: new Map([
        [aldi.id, locAldi],
        [target.id, locTarget],
      ]),
      cheapestGeneric: new Map([
        ['milk-2pct-gallon|loc-aldi', sameCents],
        ['milk-2pct-gallon|loc-target', sameCents],
      ]),
      brandedMatches: new Map(),
    });
    // Tie-break: 'Aldi' < 'Target' alphabetically.
    expect(out.results.map((r) => r.chainSlug)).toEqual(['aldi', 'target']);
    expect(out.savingsCents).toBe(0);
  });
});
