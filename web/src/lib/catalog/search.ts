/**
 * Client-side concept search.
 *
 * Tokenizes the user's query and ranks each generic concept by how well its
 * name and search_terms match. Used by the List Builder autocomplete.
 *
 * Scoring (cheap; intended for ~50–500 concepts):
 *   +5  exact match on a search term
 *   +3  search term starts with token
 *   +2  search term contains token
 *   +1  name contains token
 * Sums per concept, sorted descending. Concepts with score 0 are dropped.
 */

import { GENERIC_CONCEPT_SEEDS, type GenericConceptSeed } from './seeds';

export interface ConceptSearchResult {
  concept: GenericConceptSeed;
  score: number;
}

export function searchConcepts(query: string, limit = 8): ConceptSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: ConceptSearchResult[] = [];
  for (const concept of GENERIC_CONCEPT_SEEDS) {
    const score = scoreConcept(concept, tokens);
    if (score > 0) results.push({ concept, score });
  }
  results.sort((a, b) => b.score - a.score || a.concept.name.localeCompare(b.concept.name));
  return results.slice(0, limit);
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scoreConcept(concept: GenericConceptSeed, tokens: string[]): number {
  const name = concept.name.toLowerCase();
  const terms = concept.searchTerms.map((t) => t.toLowerCase());
  let total = 0;
  for (const token of tokens) {
    let bestForToken = 0;
    for (const term of terms) {
      if (term === token) bestForToken = Math.max(bestForToken, 5);
      else if (term.startsWith(token)) bestForToken = Math.max(bestForToken, 3);
      else if (term.includes(token)) bestForToken = Math.max(bestForToken, 2);
    }
    if (name.includes(token)) bestForToken = Math.max(bestForToken, 1);
    if (bestForToken === 0) return 0;
    total += bestForToken;
  }
  return total;
}
