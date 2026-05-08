'use client';

import { useEffect, useMemo, useState } from 'react';
import { AddItemInput } from './AddItemInput';
import { ListItemRow } from './ListItemRow';
import { loadList, saveList } from '@/lib/list/storage';
import type { ListItem } from '@/lib/list/types';
import type { GenericConceptSeed } from '@/lib/catalog/seeds';

export function ListBuilder() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount; subsequent renders are SSR-stable
  // because empty state and hydrated state both render the same shell.
  useEffect(() => {
    setItems(loadList());
    setHydrated(true);
  }, []);

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your grocery list</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Build your list, then compare prices across Springfield grocers.
        </p>
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
        onClick={() => alert('Comparison view coming soon — this will pull current prices from each Springfield grocer and pick the cheapest single store.')}
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
