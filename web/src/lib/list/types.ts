/**
 * Client-side shopping list types.
 *
 * Lives entirely in the browser (localStorage) for MVP. When/if Save & Sync
 * is added, these shapes get translated to the `lists` and `list_items` tables.
 */

export type Intent = 'generic' | 'branded';

export interface ListItem {
  /** Local UUID. Stable for the lifetime of the list. */
  id: string;
  intent: Intent;
  /** Generic concept slug, present when intent === 'generic'. */
  conceptSlug?: string;
  /** UPC, present when intent === 'branded' (not yet supported in MVP UI). */
  upc?: string;
  /** Whatever the user originally typed. */
  rawQuery: string;
  /** Resolved display name (concept.name when generic, brand product name when branded). */
  displayName: string;
  quantity: number;
  /** Department slug for grouping (mirrored from concept). */
  departmentSlug?: string;
  /** Local creation time (ms since epoch). Used for stable ordering. */
  createdAt: number;
}
