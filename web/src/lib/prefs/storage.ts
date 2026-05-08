import type { UserPreferences } from './types';

const STORAGE_KEY = 'grocery-prefs/v1';

interface StoredPrefs {
  version: 1;
  prefs: UserPreferences;
}

export function loadPrefs(): UserPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPrefs;
    if (parsed.version !== 1 || !parsed.prefs) return null;
    return parsed.prefs;
  } catch {
    return null;
  }
}

export function savePrefs(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  const payload: StoredPrefs = { version: 1, prefs };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPrefs(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
