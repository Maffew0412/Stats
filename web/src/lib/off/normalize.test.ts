import { describe, expect, it } from 'vitest';
import {
  brandSearchTerms,
  inferDepartmentFromOffTags,
  normalizeOff,
  normalizeUnit,
  parseQuantity,
} from './normalize';

describe('parseQuantity', () => {
  it('returns nulls for missing or unparseable input', () => {
    expect(parseQuantity(undefined)).toEqual({ value: null, unit: null });
    expect(parseQuantity('')).toEqual({ value: null, unit: null });
    expect(parseQuantity('large size')).toEqual({ value: null, unit: null });
  });
  it('parses metric units', () => {
    expect(parseQuantity('400 g')).toEqual({ value: '400', unit: 'g' });
    expect(parseQuantity('1.5 l')).toEqual({ value: '1.5', unit: 'l' });
    expect(parseQuantity('500ml')).toEqual({ value: '500', unit: 'ml' });
  });
  it('parses US units', () => {
    expect(parseQuantity('20 oz')).toEqual({ value: '20', unit: 'oz' });
    expect(parseQuantity('1 gal')).toEqual({ value: '1', unit: 'gal' });
    expect(parseQuantity('1 gallon')).toEqual({ value: '1', unit: 'gal' });
    expect(parseQuantity('52 fl oz')).toEqual({ value: '52', unit: 'fl oz' });
  });
  it('handles comma decimal separators', () => {
    expect(parseQuantity('1,5 kg')).toEqual({ value: '1.5', unit: 'kg' });
  });
});

describe('normalizeUnit', () => {
  it('canonicalizes common variants', () => {
    expect(normalizeUnit('gallon')).toBe('gal');
    expect(normalizeUnit('count')).toBe('ct');
    expect(normalizeUnit('pack')).toBe('ct');
    expect(normalizeUnit('pk')).toBe('ct');
    expect(normalizeUnit('each')).toBe('ea');
    expect(normalizeUnit('ea')).toBe('ea');
    expect(normalizeUnit('FL OZ')).toBe('fl oz');
  });
  it('passes through already-canonical units', () => {
    expect(normalizeUnit('oz')).toBe('oz');
    expect(normalizeUnit('lb')).toBe('lb');
  });
});

describe('normalizeOff', () => {
  it('returns null when status is 0 (not found)', () => {
    expect(normalizeOff({ status: 0 })).toBeNull();
  });
  it('returns null when product is missing', () => {
    expect(normalizeOff({ status: 1 })).toBeNull();
  });
  it('returns null when name is empty', () => {
    expect(
      normalizeOff({ status: 1, code: '1', product: { code: '1', product_name: '' } }),
    ).toBeNull();
  });
  it('extracts the first comma-separated brand', () => {
    const out = normalizeOff({
      status: 1,
      code: '1',
      product: {
        code: '1',
        product_name: 'Nutella',
        brands: 'Ferrero, Nutella',
        quantity: '400 g',
      },
    })!;
    expect(out.brand).toBe('Ferrero');
    expect(out.sizeValue).toBe('400');
    expect(out.sizeUnit).toBe('g');
  });
  it('prefers product_name_en when both are present', () => {
    const out = normalizeOff({
      status: 1,
      code: '1',
      product: {
        code: '1',
        product_name: 'Pâtes',
        product_name_en: 'Pasta',
        brands: 'Acme',
      },
    })!;
    expect(out.name).toBe('Pasta');
  });
  it('prefers image_front_url over image_url', () => {
    const out = normalizeOff({
      status: 1,
      code: '1',
      product: {
        code: '1',
        product_name: 'X',
        image_url: 'https://x/back.jpg',
        image_front_url: 'https://x/front.jpg',
      },
    })!;
    expect(out.imageUrl).toBe('https://x/front.jpg');
  });
});

describe('inferDepartmentFromOffTags', () => {
  it('matches dairy from milk/cheese/yogurt tags', () => {
    expect(inferDepartmentFromOffTags(['en:milks'])).toBe('dairy');
    expect(inferDepartmentFromOffTags(['en:cheeses'])).toBe('dairy');
    expect(inferDepartmentFromOffTags(['en:yogurts'])).toBe('dairy');
  });
  it('matches breakfast from breakfast/cereal tags', () => {
    expect(inferDepartmentFromOffTags(['en:breakfasts'])).toBe('breakfast');
    expect(inferDepartmentFromOffTags(['en:cereals'])).toBe('breakfast');
  });
  it('matches frozen', () => {
    expect(inferDepartmentFromOffTags(['en:frozen-foods'])).toBe('frozen');
  });
  it('returns null when no tag is recognized', () => {
    expect(inferDepartmentFromOffTags(['en:something-weird'])).toBeNull();
    expect(inferDepartmentFromOffTags([])).toBeNull();
  });
});

describe('brandSearchTerms', () => {
  it('includes lowercased brand and significant name words', () => {
    const terms = brandSearchTerms({
      upc: '1',
      name: 'Tomato Ketchup',
      brand: 'Heinz',
      sizeValue: null,
      sizeUnit: null,
      imageUrl: null,
      categoryTags: [],
    });
    expect(terms).toContain('heinz');
    expect(terms).toContain('tomato');
    expect(terms).toContain('ketchup');
  });
  it('drops words shorter than 3 characters', () => {
    const terms = brandSearchTerms({
      upc: '1',
      name: 'A B Cool',
      brand: null,
      sizeValue: null,
      sizeUnit: null,
      imageUrl: null,
      categoryTags: [],
    });
    expect(terms).toEqual(['cool']);
  });
});
