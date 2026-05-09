import { describe, expect, it } from 'vitest';
import { normalizeProduct, normalizeStore } from './normalize';
import type { RawAldiProduct, RawAldiStore } from './api';

describe('Aldi normalizeStore', () => {
  it('normalizes a complete store record', () => {
    const raw: RawAldiStore = {
      storeId: '47-013',
      name: 'Springfield',
      address: { line1: '2300 Stevenson Dr', city: 'Springfield', state: 'IL', postalCode: '62703' },
      geo: { latitude: 39.76, longitude: -89.63 },
    };
    expect(normalizeStore(raw)).toEqual({
      externalId: '47-013',
      name: 'Springfield',
      address: '2300 Stevenson Dr',
      city: 'Springfield',
      state: 'IL',
      zip: '62703',
      lat: 39.76,
      lng: -89.63,
    });
  });

  it('returns null when missing storeId or address', () => {
    expect(normalizeStore({} as RawAldiStore)).toBeNull();
    expect(normalizeStore({ storeId: '1' } as RawAldiStore)).toBeNull();
  });
});

describe('Aldi normalizeProduct', () => {
  const opts = { matchedGenericConceptSlug: 'milk-2pct-gallon', departmentSlug: 'dairy' };

  it('uses the variant size when present', () => {
    const raw: RawAldiProduct = {
      sku: '4099100061826',
      name: 'Friendly Farms 2% Reduced Fat Milk',
      brand: 'Friendly Farms',
      price: { value: 2.79 },
      size: { value: '1', unit: 'gal' },
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.sizeValue).toBe('1');
    expect(out.sizeUnit).toBe('gal');
    expect(out.price.regularCents).toBe(279);
    expect(out.price.saleCents).toBeUndefined();
  });

  it('falls back to parsing size from the title when variant size is missing', () => {
    const raw: RawAldiProduct = {
      sku: '1',
      name: 'Friendly Farms Lactose-Free 2% Reduced Fat Milk - 96 fl oz',
      brand: 'Friendly Farms',
      price: { amount: 4.29 },
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.sizeValue).toBe('96');
    expect(out.sizeUnit).toBe('fl oz');
  });

  it('falls back to productId when sku is missing', () => {
    const raw: RawAldiProduct = {
      productId: 'p-1',
      name: 'Whole Milk',
      price: { value: 2.5 },
    };
    expect(normalizeProduct(raw, opts)?.storeSku).toBe('p-1');
  });

  it('returns null when name is empty', () => {
    expect(
      normalizeProduct({ sku: '1', name: '   ', price: { value: 1 } }, opts),
    ).toBeNull();
  });

  it('returns null when no price is present', () => {
    expect(normalizeProduct({ sku: '1', name: 'Milk' }, opts)).toBeNull();
  });
});
