'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CHAIN_SEEDS, DEPARTMENT_SEEDS } from '@/lib/catalog/seeds';
import { loadList } from '@/lib/list/storage';
import { loadPrefs } from '@/lib/prefs/storage';
import type {
  CompareItemResult,
  CompareRequest,
  CompareResponse,
  StoreComparison,
} from '@/lib/compare/types';
import { formatMoney, formatSaleEnds, formatSize } from '@/lib/format';

interface Props {
  chainSlug: string;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'unknown-chain' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; store: StoreComparison };

const OTHER_DEPT = '__other__';

export function ShoppingMode({ chainSlug }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    const chain = CHAIN_SEEDS.find((c) => c.slug === chainSlug);
    if (!chain) {
      setStatus({ kind: 'unknown-chain' });
      return;
    }
    const prefs = loadPrefs();
    if (!prefs?.onboardedAt) {
      router.replace('/onboarding');
      return;
    }
    const list = loadList();
    if (list.length === 0) {
      setStatus({ kind: 'empty' });
      return;
    }
    void run(list, prefs.zip);

    async function run(
      items: ReturnType<typeof loadList>,
      zip: string,
    ): Promise<void> {
      const body: CompareRequest = {
        items: items.map((it) => ({
          intent: it.intent,
          conceptSlug: it.conceptSlug,
          upc: it.upc,
          rawQuery: it.rawQuery,
          displayName: it.displayName,
          quantity: it.quantity,
          departmentSlug: it.departmentSlug,
        })),
        selectedChainSlugs: [chainSlug],
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
        const store = data.results.find((r) => r.chainSlug === chainSlug);
        if (!store) {
          setStatus({
            kind: 'error',
            message:
              'No store data for this chain. Make sure the scraper for this chain has been run.',
          });
          return;
        }
        setStatus({ kind: 'ready', store });
      } catch (err) {
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load shop view',
        });
      }
    }
  }, [chainSlug, router]);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/compare"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to compare
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Edit list
        </Link>
      </header>

      {status.kind === 'loading' && <SkeletonList />}
      {status.kind === 'empty' && <EmptyState />}
      {status.kind === 'unknown-chain' && <UnknownChain chainSlug={chainSlug} />}
      {status.kind === 'error' && <ErrorState message={status.message} />}
      {status.kind === 'ready' && (
        <ReadyView store={status.store} checked={checked} onToggle={toggle} />
      )}
    </div>
  );
}

function ReadyView({
  store,
  checked,
  onToggle,
}: {
  store: StoreComparison;
  checked: Set<number>;
  onToggle: (i: number) => void;
}) {
  const indexed = useMemo(
    () => store.items.map((item, index) => ({ item, index })),
    [store.items],
  );
  const matched = indexed.filter((e) => e.item.status === 'matched');
  const unavailable = indexed.filter((e) => e.item.status !== 'matched');

  const groups = useMemo(() => groupByDepartment(matched), [matched]);

  const checkedCount = matched.filter((e) => checked.has(e.index)).length;
  const checkedCents = matched
    .filter((e) => checked.has(e.index))
    .reduce((sum, e) => sum + e.item.lineTotalCents, 0);
  const allDone = matched.length > 0 && checkedCount === matched.length;

  return (
    <>
      <div className="sticky top-2 z-10 flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Shopping at {store.chainName}
            </h1>
            <p className="text-xs text-zinc-500">{store.storeLocationAddress}</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-zinc-500">In cart</div>
            <div className="text-sm font-medium tabular-nums">
              {formatMoney(checkedCents)} / {formatMoney(store.totalCents)}
            </div>
          </div>
        </div>
        <ProgressBar value={matched.length === 0 ? 0 : checkedCount / matched.length} />
        <div className="text-xs text-zinc-500">
          {checkedCount} of {matched.length} item{matched.length === 1 ? '' : 's'} picked
          {store.onSaleCount > 0 && (
            <> · <span className="text-amber-600 dark:text-amber-400">{store.onSaleCount} on sale</span></>
          )}
        </div>
      </div>

      {allDone && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">All done.</p>
          <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
            Happy checkout. {unavailable.length > 0 && 'Don’t forget the items below — pick those up elsewhere.'}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {groups.map((group) => (
          <li key={group.slug}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.entries.map((entry) => (
                <ItemRow
                  key={entry.index}
                  entry={entry}
                  checked={checked.has(entry.index)}
                  onToggle={() => onToggle(entry.index)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {unavailable.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pick up elsewhere
          </h2>
          <ul className="flex flex-col gap-2">
            {unavailable.map((entry) => (
              <li
                key={entry.index}
                className="rounded-lg border border-dashed border-zinc-300 bg-white/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                <p className="text-sm font-medium">{entry.item.displayName}</p>
                <p className="text-xs text-zinc-500">
                  Not available at {store.chainName}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ItemRow({
  entry,
  checked,
  onToggle,
}: {
  entry: { item: CompareItemResult; index: number };
  checked: boolean;
  onToggle: () => void;
}) {
  const { item } = entry;
  const product = item.chosenProduct;
  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition dark:bg-zinc-900 ${
          checked
            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
            : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-5 w-5 cursor-pointer accent-emerald-600"
          aria-label={`Mark ${item.displayName} picked`}
        />
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${checked ? 'line-through opacity-60' : ''}`}>
            {item.displayName}
            {item.quantity > 1 && (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                × {item.quantity}
              </span>
            )}
          </div>
          {product && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>{product.name}</span>
              {(() => {
                const size = formatSize(product.sizeValue, product.sizeUnit);
                return size ? <span>· {size}</span> : null;
              })()}
              {product.saleCents !== null && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Sale
                  {(() => {
                    const ends = formatSaleEnds(product.saleEndsOn);
                    return ends ? ` · ends ${ends}` : '';
                  })()}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-sm tabular-nums">
          {product ? formatMoney(item.lineTotalCents) : '—'}
        </div>
      </label>
    </li>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface DepartmentGroup {
  slug: string;
  label: string;
  entries: { item: CompareItemResult; index: number }[];
}

function groupByDepartment(
  matched: { item: CompareItemResult; index: number }[],
): DepartmentGroup[] {
  const labelBySlug = new Map<string, string>();
  for (const d of DEPARTMENT_SEEDS) labelBySlug.set(d.slug, d.name);

  const buckets = new Map<string, { item: CompareItemResult; index: number }[]>();
  for (const entry of matched) {
    const key = entry.item.departmentSlug && labelBySlug.has(entry.item.departmentSlug)
      ? entry.item.departmentSlug
      : OTHER_DEPT;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(entry);
  }

  const groups: DepartmentGroup[] = [];
  for (const dept of DEPARTMENT_SEEDS) {
    const entries = buckets.get(dept.slug);
    if (!entries) continue;
    groups.push({ slug: dept.slug, label: dept.name, entries });
  }
  const other = buckets.get(OTHER_DEPT);
  if (other && other.length > 0) {
    groups.push({ slug: OTHER_DEPT, label: 'Other', entries: other });
  }
  return groups;
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="h-16 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </ul>
  );
}

function EmptyState() {
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

function UnknownChain({ chainSlug }: { chainSlug: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm dark:border-red-900/40 dark:bg-red-950/30">
      <p className="font-medium text-red-800 dark:text-red-300">
        Unknown chain: {chainSlug}
      </p>
      <p className="mt-1 text-red-700 dark:text-red-400">
        Pick a store from the comparison view.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm dark:border-red-900/40 dark:bg-red-950/30">
      <p className="font-medium text-red-800 dark:text-red-300">Couldn&apos;t load shopping list</p>
      <p className="mt-1 text-red-700 dark:text-red-400">{message}</p>
    </div>
  );
}
