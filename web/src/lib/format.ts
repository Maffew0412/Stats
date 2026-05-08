export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSize(value: string | null, unit: string | null): string | null {
  if (!value) return null;
  const v = String(value).replace(/\.0+$/, '');
  return unit ? `${v} ${unit}` : v;
}

export function formatSaleEnds(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
