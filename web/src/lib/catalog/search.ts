/**
 * Unified client-side autocomplete search across both generic concepts and
 * branded products.
 *
 * Tokenizes the user's query and scores each candidate by name, brand (when
 * applicable), and search_terms. Results from both pools are merged and
 * sorted by score, then by display name.
 *
 * Scoring per token (best matching field wins for that token):
 *   +5  exact match on a search term
 *   +3  search term starts with token
 *   +2  search term contains token
 *   +2  brand contains token (branded only)
 *   +1  name contains token
 * If any token scores 0, the candidate is dropped.
 */

import { BRANDED_PRODUCT_SEEDS, type BrandedProductSeed } from './branded';
import { GENERIC_CONCEPT_SEEDS, type GenericConceptSeed } from './seeds';

export type SearchResult =
  | { kind: 'generic'; score: number; concept: GenericConceptSeed }
  | { kind: 'branded'; score: number; product: BrandedProductSeed };

export function searchCatalog(query: string, limit = 8): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const out: SearchResult[] = [];
  for (const concept of GENERIC_CONCEPT_SEEDS) {
    const score = scoreGeneric(concept, tokens);
    if (score > 0) out.push({ kind: 'generic', score, concept });
  }
  for (const product of BRANDED_PRODUCT_SEEDS) {
    const score = scoreBranded(product, tokens);
    if (score > 0) out.push({ kind: 'branded', score, product });
  }
  out.sort((a, b) => b.score - a.score || labelOf(a).localeCompare(labelOf(b)));
  return out.slice(0, limit);
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scoreGeneric(concept: GenericConceptSeed, tokens: string[]): number {
  return scoreCandidate(tokens, {
    name: concept.name,
    searchTerms: concept.searchTerms,
  });
}

function scoreBranded(product: BrandedProductSeed, tokens: string[]): number {
  return scoreCandidate(tokens, {
    name: product.name,
    searchTerms: product.searchTerms,
    brand: product.brand,
  });
}

interface Candidate {
  name: string;
  searchTerms: string[];
  brand?: string;
}

function scoreCandidate(tokens: string[], c: Candidate): number {
  const name = c.name.toLowerCase();
  const brand = c.brand?.toLowerCase();
  const terms = c.searchTerms.map((t) => t.toLowerCase());
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const term of terms) {
      if (term === token) best = Math.max(best, 5);
      else if (term.startsWith(token)) best = Math.max(best, 3);
      else if (term.includes(token)) best = Math.max(best, 2);
    }
    if (brand && brand.includes(token)) best = Math.max(best, 2);
    if (name.includes(token)) best = Math.max(best, 1);
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

function labelOf(r: SearchResult): string {
  return r.kind === 'generic' ? r.concept.name : r.product.name;
}
