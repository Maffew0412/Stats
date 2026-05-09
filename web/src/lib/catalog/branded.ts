/**
 * Curated branded-product catalog used by the List Builder autocomplete and
 * by the database seed. Each entry is a real-world common-grocery item
 * keyed on its UPC.
 *
 * UPCs are placeholders that should be refreshed via the Open Food Facts
 * importer (`pnpm import-off`) before going live. They use a synthetic
 * "0099-" prefix that won't collide with real GS1 UPCs, which makes it
 * obvious in the DB which rows are seed-only and which have been verified
 * against Open Food Facts.
 *
 * Once imported, OFF will overwrite each row with the real UPC, brand
 * casing, image URL, and category from the real database. Until then the
 * UI catalog works fine, but cross-store comparisons won't actually match
 * any store_products until either the OFF UPC is present or scrapers
 * surface UPCs that we then add here.
 */

import type { DepartmentSlug } from './seeds';

export interface BrandedProductSeed {
  /** Synthetic UPC for now; replace with the OFF-verified UPC after import. */
  upc: string;
  name: string;
  brand: string;
  sizeValue: string | null;
  sizeUnit: string | null;
  departmentSlug: DepartmentSlug;
  imageUrl: string | null;
  searchTerms: string[];
}

export const BRANDED_PRODUCT_SEEDS: BrandedProductSeed[] = [
  // Breakfast
  { upc: '0099000000001', name: 'Cheerios',                       brand: 'General Mills',  sizeValue: '18',   sizeUnit: 'oz', departmentSlug: 'breakfast', imageUrl: null, searchTerms: ['cheerios', 'oat cereal'] },
  { upc: '0099000000002', name: 'Honey Nut Cheerios',              brand: 'General Mills',  sizeValue: '18.8', sizeUnit: 'oz', departmentSlug: 'breakfast', imageUrl: null, searchTerms: ['cheerios', 'honey nut cheerios'] },
  { upc: '0099000000003', name: 'Frosted Flakes',                  brand: "Kellogg's",      sizeValue: '13.5', sizeUnit: 'oz', departmentSlug: 'breakfast', imageUrl: null, searchTerms: ['frosted flakes', 'tony the tiger'] },
  { upc: '0099000000004', name: 'Pop-Tarts Frosted Strawberry',    brand: 'Pop-Tarts',      sizeValue: '8',    sizeUnit: 'ct', departmentSlug: 'breakfast', imageUrl: null, searchTerms: ['pop tarts', 'pop-tarts', 'strawberry pop tarts'] },
  { upc: '0099000000005', name: 'Eggo Homestyle Waffles',          brand: 'Eggo',           sizeValue: '12.3', sizeUnit: 'oz', departmentSlug: 'frozen',    imageUrl: null, searchTerms: ['eggo', 'waffles', 'frozen waffles'] },

  // Pantry condiments / staples
  { upc: '0099000000006', name: 'Tomato Ketchup',                  brand: 'Heinz',          sizeValue: '20',   sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ['heinz', 'ketchup'] },
  { upc: '0099000000007', name: 'Real Mayonnaise',                 brand: "Hellmann's",     sizeValue: '30',   sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ["hellmann's", 'hellmanns', 'mayo', 'mayonnaise'] },
  { upc: '0099000000008', name: 'Creamy Peanut Butter',            brand: 'Skippy',         sizeValue: '16.3', sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ['skippy', 'peanut butter'] },
  { upc: '0099000000009', name: 'Creamy Peanut Butter',            brand: 'Jif',            sizeValue: '16',   sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ['jif', 'peanut butter'] },
  { upc: '0099000000010', name: 'Strawberry Preserves',            brand: "Smucker's",      sizeValue: '18',   sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ["smucker's", 'smuckers', 'jam', 'jelly', 'strawberry jam'] },
  { upc: '0099000000011', name: 'Original Mac & Cheese',           brand: 'Kraft',          sizeValue: '7.25', sizeUnit: 'oz', departmentSlug: 'pantry',    imageUrl: null, searchTerms: ['kraft', 'mac and cheese', 'mac & cheese', 'macaroni'] },

  // Beverages
  { upc: '0099000000012', name: 'Coca-Cola Classic, 12 pack',      brand: 'Coca-Cola',      sizeValue: '12',   sizeUnit: 'ct', departmentSlug: 'beverages', imageUrl: null, searchTerms: ['coca cola', 'coca-cola', 'coke'] },
  { upc: '0099000000013', name: 'Pepsi Cola, 12 pack',             brand: 'Pepsi',          sizeValue: '12',   sizeUnit: 'ct', departmentSlug: 'beverages', imageUrl: null, searchTerms: ['pepsi'] },
  { upc: '0099000000014', name: '100% Orange Juice',               brand: 'Tropicana',      sizeValue: '52',   sizeUnit: 'oz', departmentSlug: 'beverages', imageUrl: null, searchTerms: ['tropicana', 'orange juice', 'oj'] },
  { upc: '0099000000015', name: 'Classic Roast Ground Coffee',     brand: 'Folgers',        sizeValue: '30.5', sizeUnit: 'oz', departmentSlug: 'beverages', imageUrl: null, searchTerms: ['folgers', 'coffee'] },

  // Snacks
  { upc: '0099000000016', name: 'Classic Potato Chips',            brand: "Lay's",          sizeValue: '8',    sizeUnit: 'oz', departmentSlug: 'snacks',    imageUrl: null, searchTerms: ["lay's", 'lays', 'potato chips'] },
  { upc: '0099000000017', name: 'Nacho Cheese Tortilla Chips',     brand: 'Doritos',        sizeValue: '9.25', sizeUnit: 'oz', departmentSlug: 'snacks',    imageUrl: null, searchTerms: ['doritos', 'nacho cheese chips'] },
  { upc: '0099000000018', name: 'Original Cookies',                brand: 'Oreo',           sizeValue: '14.3', sizeUnit: 'oz', departmentSlug: 'snacks',    imageUrl: null, searchTerms: ['oreo', 'oreos', 'cookies'] },

  // Household
  { upc: '0099000000019', name: 'Liquid Laundry Detergent Original', brand: 'Tide',         sizeValue: '50',   sizeUnit: 'oz', departmentSlug: 'household', imageUrl: null, searchTerms: ['tide', 'laundry detergent'] },
  { upc: '0099000000020', name: 'Ultra Soft Toilet Paper, 12 mega rolls', brand: 'Charmin', sizeValue: '12',   sizeUnit: 'ct', departmentSlug: 'household', imageUrl: null, searchTerms: ['charmin', 'toilet paper', 'tp'] },
];
