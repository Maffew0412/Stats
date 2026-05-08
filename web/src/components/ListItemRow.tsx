'use client';

import type { ListItem } from '@/lib/list/types';

interface Props {
  item: ListItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function ListItemRow({ item, onQuantityChange, onRemove }: Props) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{item.displayName}</p>
          <IntentBadge intent={item.intent} />
        </div>
        {item.departmentSlug && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-zinc-500">
            {item.departmentSlug}
          </p>
        )}
      </div>

      <QuantityControl
        value={item.quantity}
        onChange={(q) => onQuantityChange(item.id, q)}
      />

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.displayName}`}
        className="text-zinc-400 transition hover:text-red-600 dark:hover:text-red-400"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

function IntentBadge({ intent }: { intent: ListItem['intent'] }) {
  const isGeneric = intent === 'generic';
  return (
    <span
      title={
        isGeneric
          ? 'Generic intent — matches any qualifying product'
          : 'Brand-specific — matches the exact UPC across stores'
      }
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isGeneric
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
      }`}
    >
      {isGeneric ? 'Generic' : 'Brand'}
    </span>
  );
}

function QuantityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-zinc-300 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
        disabled={value <= 1}
        className="h-8 w-8 text-lg leading-none text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        −
      </button>
      <span className="w-8 text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="h-8 w-8 text-lg leading-none text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        +
      </button>
    </div>
  );
}
