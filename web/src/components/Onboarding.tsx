'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CHAIN_SEEDS } from '@/lib/catalog/seeds';
import { loadPrefs, savePrefs } from '@/lib/prefs/storage';
import type { UserPreferences } from '@/lib/prefs/types';

const DEFAULT_ZIP = '62704';
const ZIP_PATTERN = /^\d{5}$/;

export function Onboarding() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [zip, setZip] = useState(DEFAULT_ZIP);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(CHAIN_SEEDS.map((c) => c.slug)),
  );
  const isEditing = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return loadPrefs() !== null;
  }, []);

  useEffect(() => {
    const existing = loadPrefs();
    if (existing) {
      setZip(existing.zip || DEFAULT_ZIP);
      setSelected(new Set(existing.selectedChainSlugs));
    }
    setHydrated(true);
  }, []);

  const zipValid = ZIP_PATTERN.test(zip);
  const hasSelection = selected.size > 0;
  const canContinue = hydrated && zipValid && hasSelection;

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(CHAIN_SEEDS.map((c) => c.slug)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function save() {
    if (!canContinue) return;
    const next: UserPreferences = {
      zip,
      selectedChainSlugs: [...selected],
      onboardedAt: Date.now(),
    };
    savePrefs(next);
    router.push('/');
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? 'Settings' : 'Welcome'}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {isEditing
            ? 'Update your ZIP and which Springfield grocers to include in comparisons.'
            : 'Pick your ZIP and the Springfield grocers you want to compare. We’ll find the cheapest single store for your full list.'}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <label htmlFor="zip" className="text-sm font-medium">
          ZIP code
        </label>
        <input
          id="zip"
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
          placeholder="62704"
          className="w-full max-w-[10rem] rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          aria-invalid={zip.length > 0 && !zipValid}
        />
        {zip.length > 0 && !zipValid && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Enter a 5-digit ZIP code.
          </p>
        )}
        <p className="text-xs text-zinc-500">
          Springfield, IL launch market — other ZIPs save fine but won&apos;t have prices yet.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Stores to compare</h2>
            <p className="text-xs text-zinc-500">
              Uncheck stores you don&apos;t shop at — fewer stores = faster comparisons.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              All
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              None
            </button>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHAIN_SEEDS.map((chain) => {
            const checked = selected.has(chain.slug);
            return (
              <li key={chain.slug}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition dark:bg-zinc-900 ${
                    checked
                      ? 'border-zinc-900 ring-1 ring-zinc-900/10 dark:border-zinc-100 dark:ring-zinc-100/10'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(chain.slug)}
                    className="h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-sm font-medium">{chain.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {!hasSelection && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Pick at least one store to continue.
          </p>
        )}
      </section>

      <div className="sticky bottom-4 mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!canContinue}
          onClick={save}
          className="flex-1 rounded-xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEditing ? 'Save changes' : 'Get started'}
        </button>
        {isEditing && (
          <Link
            href="/"
            className="rounded-xl border border-zinc-300 px-4 py-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        )}
      </div>
    </div>
  );
}
