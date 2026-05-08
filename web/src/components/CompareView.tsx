'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadList } from '@/lib/list/storage';
import { loadPrefs } from '@/lib/prefs/storage';
import type { ListItem } from '@/lib/list/types';
import type { CompareRequest, CompareResponse } from '@/lib/compare/types';
import { formatMoney } from '@/lib/format';
import { StoreResultRow } from './StoreResultRow';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: CompareResponse };

export function CompareView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const prefs = loadPrefs();
    if (!prefs?.onboardedAt) {
      router.replace('/onboarding');
      return;
    }
    const items = loadList();
    if (items.length === 0) {
      setStatus({ kind: 'empty' });
      return;
    }
    void run(items, prefs.selectedChainSlugs, prefs.zip);

    async function run(list: ListItem[], selectedChainSlugs: string[], zip: string) {
      setStatus({ kind: 'loading' });
      const body: CompareRequest = {
        items: list.map((it) => ({
          intent: it.intent,
          conceptSlug: it.conceptSlug,
          upc: it.upc,
          rawQuery: it.rawQuery,
          displayName: it.displayName,
          quantity: it.quantity,
          departmentSlug: it.departmentSlug,
        })),
        selectedChainSlugs,
        zip,
      };
      try {
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as CompareResponse;
        setStatus({ kind: 'ready', data });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to compare prices';
        setStatus({ kind: 'error', message });
      }
    }
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare prices</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Today&apos;s totals across Springfield grocers.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Edit list
        </Link>
      </header>

      {status.kind === 'idle' && <SkeletonList />}
      {status.kind === 'loading' && <SkeletonList />}
      {status.kind === 'empty' && <EmptyList />}
      {status.kind === 'error' && <ErrorState message={status.message} />}
      {status.kind === 'ready' && <ResultsList data={status.data} />}
    </div>
  );
}

function ResultsList({ data }: { data: CompareResponse }) {
  if (data.results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/50 px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        No stores configured. Seed a chain first or run a scraper.
      </div>
    );
  }

  return (
    <>
      {data.winnerChainSlug && data.savingsCents > 0 && (
        <WinnerCard data={data} />
      )}
      <ul className="flex flex-col gap-2">
        {data.results.map((store) => (
          <StoreResultRow
            key={store.storeLocationId}
            store={store}
            isWinner={store.chainSlug === data.winnerChainSlug}
          />
        ))}
      </ul>
    </>
  );
}

function WinnerCard({ data }: { data: CompareResponse }) {
  const winner = data.results.find((r) => r.chainSlug === data.winnerChainSlug);
  if (!winner) return null;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Best total today
      </p>
      <div className="mt-1 flex items-baseline gap-3">
        <h2 className="text-2xl font-semibold">{winner.chainName}</h2>
        <span className="text-2xl font-semibold tabular-nums">
          {formatMoney(winner.totalCents)}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Save <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          {formatMoney(data.savingsCents)}
        </span>{' '}
        vs. the next-best store.
        {winner.unavailableCount > 0 && (
          <>
            {' '}
            <span className="text-zinc-500">
              {winner.unavailableCount} item{winner.unavailableCount === 1 ? '' : 's'} not available here.
            </span>
          </>
        )}
      </p>
      <Link
        href={`/shop/${winner.chainSlug}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        Shop at {winner.chainName}
      </Link>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-20 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </ul>
  );
}

function EmptyList() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white/50 px-6 py-10 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-zinc-700 dark:text-zinc-300">Your list is empty.</p>
      <Link
        href="/"
        className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Build your list
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm dark:border-red-900/40 dark:bg-red-950/30">
      <p className="font-medium text-red-800 dark:text-red-300">Couldn&apos;t load prices</p>
      <p className="mt-1 text-red-700 dark:text-red-400">{message}</p>
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-400/80">
        If you&apos;re running locally, make sure DATABASE_URL is set and you&apos;ve seeded the database (
        <code>pnpm db:push &amp;&amp; pnpm db:seed</code>) and run a scraper to populate prices.
      </p>
    </div>
  );
}
