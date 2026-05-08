/**
 * localStorage-backed list persistence.
 *
 * Single list for MVP (multi-list is a v2 feature). Schema-versioned so we can
 * migrate the on-disk format later without losing user data.
 */

import type { ListItem } from './types';

const STORAGE_KEY = 'grocery-list/v1';

interface StoredList {
  version: 1;
  items: ListItem[];
}

export function loadList(): ListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredList;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items;
  } catch {
    return [];
  }
}

export function saveList(items: ListItem[]): void {
  if (typeof window === 'undefined') return;
  const payload: StoredList = { version: 1, items };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearList(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
