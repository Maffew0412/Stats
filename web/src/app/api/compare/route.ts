import { compareList } from '@/lib/compare/compare';
import type { CompareRequest, CompareRequestItem } from '@/lib/compare/types';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseRequest(body);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await compareList(parsed);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('compare failed:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseRequest(body: unknown): CompareRequest | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Body must be an object' };
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.items)) return { error: 'items must be an array' };
  const items: CompareRequestItem[] = [];
  for (const [i, raw] of b.items.entries()) {
    if (!raw || typeof raw !== 'object') {
      return { error: `items[${i}] must be an object` };
    }
    const r = raw as Record<string, unknown>;
    const intent = r.intent;
    if (intent !== 'generic' && intent !== 'branded') {
      return { error: `items[${i}].intent must be 'generic' or 'branded'` };
    }
    const quantity = typeof r.quantity === 'number' ? r.quantity : 1;
    if (quantity <= 0) return { error: `items[${i}].quantity must be > 0` };
    if (intent === 'generic' && typeof r.conceptSlug !== 'string') {
      return { error: `items[${i}] (generic) requires conceptSlug` };
    }
    if (intent === 'branded' && typeof r.upc !== 'string') {
      return { error: `items[${i}] (branded) requires upc` };
    }
    items.push({
      intent,
      conceptSlug: typeof r.conceptSlug === 'string' ? r.conceptSlug : undefined,
      upc: typeof r.upc === 'string' ? r.upc : undefined,
      rawQuery: typeof r.rawQuery === 'string' ? r.rawQuery : '',
      displayName: typeof r.displayName === 'string' ? r.displayName : '',
      quantity,
      departmentSlug: typeof r.departmentSlug === 'string' ? r.departmentSlug : undefined,
    });
  }

  const selectedChainSlugs =
    Array.isArray(b.selectedChainSlugs) && b.selectedChainSlugs.every((x) => typeof x === 'string')
      ? (b.selectedChainSlugs as string[])
      : undefined;

  return {
    items,
    selectedChainSlugs,
    zip: typeof b.zip === 'string' ? b.zip : undefined,
  };
}
