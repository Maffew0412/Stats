import { describe, expect, it } from 'vitest';
import { searchCatalog, tokenize } from './search';

describe('tokenize', () => {
  it('splits on whitespace and commas, lowercases', () => {
    expect(tokenize('Heinz Ketchup, Large')).toEqual(['heinz', 'ketchup', 'large']);
  });
  it('drops empty tokens', () => {
    expect(tokenize('  milk  ')).toEqual(['milk']);
    expect(tokenize(',,,milk,,')).toEqual(['milk']);
  });
  it('returns empty array for whitespace-only', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('searchCatalog', () => {
  it('returns empty when query is empty', () => {
    expect(searchCatalog('', 8)).toEqual([]);
    expect(searchCatalog('  ', 8)).toEqual([]);
  });

  it('matches a generic concept by exact search-term', () => {
    const results = searchCatalog('milk', 8);
    const slugs = results.filter((r) => r.kind === 'generic').map((r) => r.concept.slug);
    // Several milk concepts exist in seeds; all should match on the term 'milk'.
    expect(slugs).toContain('milk-2pct-gallon');
    expect(slugs).toContain('milk-whole-gallon');
  });

  it('matches a branded product by brand name', () => {
    const results = searchCatalog('heinz', 8);
    const upcs = results.filter((r) => r.kind === 'branded').map((r) => r.product.upc);
    expect(upcs.length).toBeGreaterThan(0);
    // Heinz Tomato Ketchup is one of the seeded UPCs (0099000000006).
    expect(upcs).toContain('0099000000006');
  });

  it('matches a branded product by name token', () => {
    const results = searchCatalog('cheerios', 8);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kind === 'branded' || r.concept.name.toLowerCase().includes('cheerios'))).toBe(true);
    const branded = results.filter((r) => r.kind === 'branded');
    expect(branded.length).toBeGreaterThanOrEqual(1);
  });

  it('returns mixed generic + branded results when both match', () => {
    // 'coffee' matches a generic concept (coffee-ground-12oz) AND a branded
    // product (Folgers Classic Roast, with 'coffee' in its name).
    const results = searchCatalog('coffee', 8);
    const kinds = new Set(results.map((r) => r.kind));
    expect(kinds.has('generic')).toBe(true);
    expect(kinds.has('branded')).toBe(true);
  });

  it('drops candidates where any token has zero score', () => {
    // 'milk zzzzzz' won't match anything because zzzzzz scores 0 everywhere.
    expect(searchCatalog('milk zzzzzz', 8)).toEqual([]);
  });

  it('respects the limit', () => {
    const all = searchCatalog('milk', 100);
    expect(all.length).toBeGreaterThan(2);
    const limited = searchCatalog('milk', 2);
    expect(limited.length).toBe(2);
  });

  it('ranks exact-term matches above contains matches', () => {
    // Bananas concept's search_terms include the exact 'bananas'.
    const results = searchCatalog('banana', 8);
    expect(results.length).toBeGreaterThan(0);
    // Top result should be the bananas concept.
    const top = results[0];
    expect(top.kind).toBe('generic');
    if (top.kind === 'generic') {
      expect(top.concept.slug).toBe('bananas-lb');
    }
  });
});
