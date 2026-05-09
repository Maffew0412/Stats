'use client';

import { useEffect, useRef, useState } from 'react';
import { searchCatalog, type SearchResult } from '@/lib/catalog/search';

interface Props {
  onPick: (result: SearchResult, rawQuery: string) => void;
}

const MAX_SUGGESTIONS = 8;

export function AddItemInput({ onPick }: Props) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions: SearchResult[] = query.trim().length >= 1
    ? searchCatalog(query, MAX_SUGGESTIONS)
    : [];

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function pick(result: SearchResult) {
    onPick(result, query);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Add to your list — milk, Cheerios, Heinz ketchup…"
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="add-item-suggestions"
      />
      {open && suggestions.length > 0 && (
        <ul
          id="add-item-suggestions"
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {suggestions.map((s, i) => (
            <li key={keyOf(s)}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                  i === highlight
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <KindBadge kind={s.kind} />
                <span className="min-w-0 flex-1 truncate">
                  {s.kind === 'generic' ? (
                    <span className="font-medium">{s.concept.name}</span>
                  ) : (
                    <span>
                      <span className="text-zinc-500">{s.product.brand} </span>
                      <span className="font-medium">{s.product.name}</span>
                      {s.product.sizeValue && s.product.sizeUnit && (
                        <span className="text-zinc-500">
                          {' '}
                          · {s.product.sizeValue} {s.product.sizeUnit}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  {s.kind === 'generic' ? s.concept.departmentSlug : s.product.departmentSlug}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: SearchResult['kind'] }) {
  const isGeneric = kind === 'generic';
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isGeneric
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
      }`}
      aria-hidden
    >
      {isGeneric ? 'Generic' : 'Brand'}
    </span>
  );
}

function keyOf(r: SearchResult): string {
  return r.kind === 'generic' ? `g:${r.concept.slug}` : `b:${r.product.upc}`;
}
