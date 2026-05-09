import { describe, expect, it } from 'vitest';
import { normalizeProduct, normalizeStore } from './normalize';
import type { RawRosieProduct, RawRosieStore } from './api';

describe('Rosie normalizeStore', () => {
  it('normalizes a Rosie store payload', () => {
    const raw: RawRosieStore = {
      id: 'cm-springfield',
      name: 'County Market - South 6th',
      address: {
        streetAddress: '2777 S 6th St',
        addressLocality: 'Springfield',
        addressRegion: 'IL',
        postalCode: '62703',
      },
      geo: { latitude: 39.76, longitude: -89.65 },
    };
    expect(normalizeStore(raw)).toEqual({
      externalId: 'cm-springfield',
      name: 'County Market - South 6th',
      address: '2777 S 6th St',
      city: 'Springfield',
      state: 'IL',
      zip: '62703',
      lat: 39.76,
      lng: -89.65,
    });
  });

  it('returns null without id or street address', () => {
    expect(normalizeStore({} as RawRosieStore)).toBeNull();
  });
});

describe('Rosie normalizeProduct', () => {
  const opts = { matchedGenericConceptSlug: 'milk-2pct-gallon', departmentSlug: 'dairy' };

  it('detects sale prices and ends-on dates', () => {
    const raw: RawRosieProduct = {
      id: 'cm-1',
      name: "Dean's 2% Reduced Fat Milk",
      brand: "Dean's",
      price: 4.29,
      salePrice: 3.79,
      saleEndsOn: '2026-05-12',
      size: '1 gal',
      upc: '041900070625',
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.price.regularCents).toBe(429);
    expect(out.price.saleCents).toBe(379);
    expect(out.price.saleEndsOn).toBe('2026-05-12');
    expect(out.upc).toBe('041900070625');
    expect(out.sizeValue).toBe('1');
    expect(out.sizeUnit).toBe('gal');
  });

  it('omits sale when sale equals regular', () => {
    const raw: RawRosieProduct = {
      id: '2',
      name: 'Milk',
      price: 3.99,
      salePrice: 3.99,
      saleEndsOn: '2026-05-15',
      size: '1 gal',
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.price.regularCents).toBe(399);
    expect(out.price.saleCents).toBeUndefined();
    expect(out.price.saleEndsOn).toBeUndefined();
  });

  it('parses size from free-text strings, including half gallons', () => {
    const raw: RawRosieProduct = {
      id: '3',
      name: 'Prairie Farms 2% Milk',
      price: 2.49,
      size: '0.5 gal',
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.sizeValue).toBe('0.5');
    expect(out.sizeUnit).toBe('gal');
  });

  it('falls back to parsing size from the title when size string is missing', () => {
    const out = normalizeProduct(
      { id: '4', name: 'Some Brand Milk - 16 oz', price: 1.99 },
      opts,
    )!;
    expect(out.sizeValue).toBe('16');
    expect(out.sizeUnit).toBe('oz');
  });

  it('returns null when id and productId are both missing', () => {
    expect(
      normalizeProduct({ name: 'no id', price: 1 } as RawRosieProduct, opts),
    ).toBeNull();
  });
});
