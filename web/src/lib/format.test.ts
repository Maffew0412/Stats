import { describe, expect, it } from 'vitest';
import { formatMoney, formatSaleEnds, formatSize } from './format';

describe('formatMoney', () => {
  it('formats whole dollars with cents', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(100)).toBe('$1.00');
    expect(formatMoney(1234)).toBe('$12.34');
  });
  it('handles large amounts with thousands separator', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
  });
  it('rounds-trips negatives unchanged', () => {
    expect(formatMoney(-150)).toBe('-$1.50');
  });
});

describe('formatSize', () => {
  it('returns null when value is missing', () => {
    expect(formatSize(null, 'gal')).toBeNull();
    expect(formatSize(null, null)).toBeNull();
  });
  it('combines value and unit', () => {
    expect(formatSize('1', 'gal')).toBe('1 gal');
    expect(formatSize('16', 'oz')).toBe('16 oz');
  });
  it('drops trailing zeros from numeric strings', () => {
    expect(formatSize('1.0', 'gal')).toBe('1 gal');
    expect(formatSize('1.50', 'gal')).toBe('1.5 gal');
  });
  it('returns just the value when unit is null', () => {
    expect(formatSize('12', null)).toBe('12');
  });
});

describe('formatSaleEnds', () => {
  it('returns null for null input', () => {
    expect(formatSaleEnds(null)).toBeNull();
  });
  it('returns null for malformed dates', () => {
    expect(formatSaleEnds('not-a-date')).toBeNull();
  });
  it('formats ISO dates as month + day', () => {
    expect(formatSaleEnds('2026-05-12')).toBe('May 12');
    expect(formatSaleEnds('2026-12-01')).toBe('Dec 1');
  });
});
