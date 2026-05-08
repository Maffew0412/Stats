'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AddItemInput } from './AddItemInput';
import { ListItemRow } from './ListItemRow';
import { loadList, saveList } from '@/lib/list/storage';
import { loadPrefs } from '@/lib/prefs/storage';
import type { ListItem } from '@/lib/list/types';
import type { GenericConceptSeed } from '@/lib/catalog/seeds';

export function ListBuilder() {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount. If the user hasn't completed
  // onboarding, redirect there before showing the list shell.
  useEffect(() => {
    const prefs = loadPrefs();
    if (!prefs?.onboardedAt) {
      router.replace('/onboarding');
      return;
    }
    setItems(loadList());
    setHydrated(true);
  }, [router]);

  useEffect(() => {
    if (hydrated) saveList(items);
  }, [items, hydrated]);

  function addConcept(concept: GenericConceptSeed, rawQuery: string) {
    setItems((prev) => {
      const existing = prev.find(
        (it) => it.intent === 'generic' && it.conceptSlug === concept.slug,
      );
      if (existing) {
        return prev.map((it) =>
          it.id === existing.id ? { ...it, quantity: it.quantity + 1 } : it,
        );
      }
      const next: ListItem = {
        id: crypto.randomUUID(),
        intent: 'generic',
        conceptSlug: concept.slug,
        rawQuery,
        displayName: concept.name,
        quantity: 1,
        departmentSlug: concept.departmentSlug,
        createdAt: Date.now(),
      };
      return [...prev, next];
    });
  }

  function setQuantity(id: string, quantity: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity } : it)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clear() {
    setItems([]);
  }

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.createdAt - b.createdAt), [items]);
  const totalCount = items.reduce((sum, it) => sum + it.quantity, 0);

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12" />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your grocery list</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Build your list, then compare prices across Springfield grocers.
          </p>
        </div>
        <Link
          href="/onboarding"
          aria-label="Settings"
          className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.379.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </Link>
      </header>

      <AddItemInput onPick={addConcept} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {items.length === 0
              ? 'No items yet'
              : `${items.length} item${items.length === 1 ? '' : 's'} · ${totalCount} unit${totalCount === 1 ? '' : 's'}`}
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-zinc-500 transition hover:text-red-600 dark:hover:text-red-400"
            >
              Clear list
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                onQuantityChange={setQuantity}
                onRemove={remove}
              />
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        disabled={items.length === 0}
        onClick={() => router.push('/compare')}
        className="sticky bottom-4 mt-auto w-full rounded-xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Compare prices
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Start typing above to add items. Try{' '}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">milk</span>,{' '}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">eggs</span>, or{' '}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">bananas</span>.
      </p>
    </div>
  );
}
