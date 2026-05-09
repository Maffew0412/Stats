import { describe, expect, it } from 'vitest';
import { normalizeProduct, normalizeStore } from './normalize';
import type { RawNearbyStore, RawSearchItem } from './api';

describe('Target normalizeStore', () => {
  it('normalizes a complete store record', () => {
    const raw: RawNearbyStore = {
      store_id: '1424',
      location_name: 'Springfield',
      mailing_address: {
        address_line1: '2125 Wabash Ave',
        city: 'Springfield',
        state: 'IL',
        postal_code: '62704',
      },
      geographic_specifications: { latitude: 39.77, longitude: -89.69 },
    };
    expect(normalizeStore(raw)).toEqual({
      externalId: '1424',
      name: 'Springfield',
      address: '2125 Wabash Ave',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      lat: 39.77,
      lng: -89.69,
    });
  });

  it('returns null when required fields are missing', () => {
    expect(normalizeStore({ store_id: '1' } as RawNearbyStore)).toBeNull();
    expect(
      normalizeStore({ mailing_address: { address_line1: 'x' } } as RawNearbyStore),
    ).toBeNull();
  });

  it('falls back to a generic name and uppercases two-letter state', () => {
    const raw: RawNearbyStore = {
      store_id: '999',
      mailing_address: { address_line1: 'X', state: 'il', postal_code: '62704' },
    };
    const out = normalizeStore(raw)!;
    expect(out.name).toBe('Target 999');
    expect(out.state).toBe('IL');
  });
});

describe('Target normalizeProduct', () => {
  const opts = { matchedGenericConceptSlug: 'milk-2pct-gallon', departmentSlug: 'dairy' };

  it('extracts size from title and detects sale price', () => {
    const raw: RawSearchItem = {
      tcin: '13282899',
      item: {
        product_description: { title: '2% Reduced Fat Milk - 1gal - Good & Gather™' },
        primary_brand: { name: 'Good & Gather' },
        enrichment: { images: { primary_image_url: 'https://x.png' } },
      },
      price: { current_retail: 3.49, reg_retail: 3.99 },
    };
    const out = normalizeProduct(raw, opts)!;
    expect(out.storeSku).toBe('13282899');
    expect(out.brand).toBe('Good & Gather');
    expect(out.sizeValue).toBe('1');
    expect(out.sizeUnit).toBe('gal');
    expect(out.price.regularCents).toBe(399);
    expect(out.price.saleCents).toBe(349);
    expect(out.matchedGenericConceptSlugs).toEqual(['milk-2pct-gallon']);
    expect(out.departmentSlug).toBe('dairy');
  });

  it('omits sale when current equals regular', () => {
    const out = normalizeProduct(
      {
        tcin: '1',
        item: { product_description: { title: 'Borden 2% Milk - 1gal' } },
        price: { current_retail: 3.89, reg_retail: 3.89 },
      },
      opts,
    )!;
    expect(out.price.regularCents).toBe(389);
    expect(out.price.saleCents).toBeUndefined();
  });

  it('parses fl oz as a multi-word unit', () => {
    const out = normalizeProduct(
      {
        tcin: '2',
        item: { product_description: { title: 'Fairlife 2% Reduced Fat Milk - 52 fl oz' } },
        price: { current_retail: 4.49 },
      },
      opts,
    )!;
    expect(out.sizeValue).toBe('52');
    expect(out.sizeUnit).toBe('fl oz');
  });

  it('returns null when tcin is missing', () => {
    expect(
      normalizeProduct(
        { item: { product_description: { title: 'No tcin' } }, price: { current_retail: 1 } },
        opts,
      ),
    ).toBeNull();
  });

  it('returns null when title is missing', () => {
    expect(
      normalizeProduct({ tcin: '3', price: { current_retail: 1 } }, opts),
    ).toBeNull();
  });

  it('returns null when no usable price is present', () => {
    expect(
      normalizeProduct(
        {
          tcin: '4',
          item: { product_description: { title: 'No price - 1gal' } },
        },
        opts,
      ),
    ).toBeNull();
  });
});
