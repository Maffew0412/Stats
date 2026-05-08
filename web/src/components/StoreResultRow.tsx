'use client';

import { useState } from 'react';
import type { StoreComparison } from '@/lib/compare/types';
import { formatMoney, formatSaleEnds, formatSize } from '@/lib/format';

interface Props {
  store: StoreComparison;
  isWinner: boolean;
}

export function StoreResultRow({ store, isWinner }: Props) {
  const [open, setOpen] = useState(false);
  const hasMatches = store.matchedCount > 0;

  return (
    <li
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition dark:bg-zinc-900 ${
        isWinner
          ? 'border-emerald-300 ring-2 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900/40'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{store.chainName}</h3>
            {isWinner && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Best price
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {store.storeLocationName} · {store.storeLocationAddress}
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              {store.matchedCount}/{store.matchedCount + store.unavailableCount} matched
            </span>
            {store.onSaleCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                · {store.onSaleCount} on sale
              </span>
            )}
            {store.unavailableCount > 0 && (
              <span className="text-zinc-500">
                · {store.unavailableCount} unavailable
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums">
            {hasMatches ? formatMoney(store.totalCents) : '—'}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            {open ? 'Hide items' : 'See items'}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {store.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.displayName}</div>
                  {item.chosenProduct && (
                    <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>{item.chosenProduct.name}</span>
                      {(() => {
                        const size = formatSize(
                          item.chosenProduct.sizeValue,
                          item.chosenProduct.sizeUnit,
                        );
                        return size ? <span> · {size}</span> : null;
                      })()}
                      {item.chosenProduct.saleCents !== null && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Sale
                          {(() => {
                            const ends = formatSaleEnds(item.chosenProduct.saleEndsOn);
                            return ends ? ` · ends ${ends}` : '';
                          })()}
                        </span>
                      )}
                    </div>
                  )}
                  {item.status === 'unavailable' && (
                    <div className="mt-0.5 text-xs italic text-zinc-500">
                      Not available — pick up elsewhere
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  {item.status === 'matched' && item.chosenProduct ? (
                    <>
                      <div>{formatMoney(item.lineTotalCents)}</div>
                      {item.quantity > 1 && (
                        <div className="text-[11px] text-zinc-500">
                          {formatMoney(item.chosenProduct.unitPriceCents)} × {item.quantity}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-zinc-400">—</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
