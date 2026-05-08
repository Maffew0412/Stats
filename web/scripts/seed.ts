/**
 * Seed reference data: chains, departments, and a starter set of generic concepts.
 *
 * `store_locations` is intentionally NOT seeded here — each chain's `external_id`
 * (the store number used by its site/API) is discovered when we wire up that
 * chain's scraper, so locations are inserted as part of per-chain bootstrapping.
 *
 * Idempotent: re-running this script will not duplicate rows. Conflicts on the
 * unique slug column are ignored.
 */

import 'dotenv/config';
import { db } from '../src/lib/db';
import { chains, departments, genericConcepts } from '../src/lib/db/schema';

const CHAIN_SEEDS = [
  { slug: 'aldi',           name: 'Aldi',           scraperKey: 'aldi'     },
  { slug: 'target',         name: 'Target',         scraperKey: 'target'   },
  { slug: 'walmart',        name: 'Walmart',        scraperKey: 'walmart'  },
  { slug: 'meijer',         name: 'Meijer',         scraperKey: 'meijer'   },
  { slug: 'hy-vee',         name: 'Hy-Vee',         scraperKey: 'hy-vee'   },
  { slug: 'schnucks',       name: 'Schnucks',       scraperKey: 'schnucks' },
  // County Market and Harvest Market are distinct chains that share the Rosie
  // e-commerce platform, so a single 'rosie' scraper services both.
  { slug: 'county-market',  name: 'County Market',  scraperKey: 'rosie'    },
  { slug: 'harvest-market', name: 'Harvest Market', scraperKey: 'rosie'    },
] as const;

const DEPARTMENT_SEEDS = [
  { slug: 'produce',       name: 'Produce'       },
  { slug: 'meat',          name: 'Meat'          },
  { slug: 'seafood',       name: 'Seafood'       },
  { slug: 'deli',          name: 'Deli'          },
  { slug: 'bakery',        name: 'Bakery'        },
  { slug: 'dairy',         name: 'Dairy'         },
  { slug: 'frozen',        name: 'Frozen'        },
  { slug: 'pantry',        name: 'Pantry'        },
  { slug: 'beverages',     name: 'Beverages'     },
  { slug: 'snacks',        name: 'Snacks'        },
  { slug: 'breakfast',     name: 'Breakfast'     },
  { slug: 'household',     name: 'Household'     },
  { slug: 'personal-care', name: 'Personal Care' },
  { slug: 'baby',          name: 'Baby'          },
] as const;

type GenericConceptSeed = {
  slug: string;
  name: string;
  departmentSlug: (typeof DEPARTMENT_SEEDS)[number]['slug'];
  attributes: Record<string, unknown>;
  sizeValue: string | null;
  sizeUnit: string | null;
  searchTerms: string[];
};

const GENERIC_CONCEPT_SEEDS: GenericConceptSeed[] = [
  // Dairy
  { slug: 'milk-2pct-gallon',     name: '2% milk, 1 gallon',     departmentSlug: 'dairy',  attributes: { fat: '2%',    kind: 'cow' }, sizeValue: '1', sizeUnit: 'gal', searchTerms: ['milk', '2 percent', 'two percent milk', '2% milk'] },
  { slug: 'milk-whole-gallon',    name: 'Whole milk, 1 gallon',  departmentSlug: 'dairy',  attributes: { fat: 'whole', kind: 'cow' }, sizeValue: '1', sizeUnit: 'gal', searchTerms: ['milk', 'whole milk'] },
  { slug: 'milk-skim-gallon',     name: 'Skim milk, 1 gallon',   departmentSlug: 'dairy',  attributes: { fat: 'skim',  kind: 'cow' }, sizeValue: '1', sizeUnit: 'gal', searchTerms: ['milk', 'skim milk', 'fat free milk'] },
  { slug: 'eggs-large-dozen',     name: 'Large eggs, 1 dozen',   departmentSlug: 'dairy',  attributes: { size: 'large' },             sizeValue: '12', sizeUnit: 'ct',  searchTerms: ['eggs', 'large eggs', 'dozen eggs'] },
  { slug: 'butter-salted-1lb',    name: 'Salted butter, 1 lb',   departmentSlug: 'dairy',  attributes: { kind: 'salted' },            sizeValue: '1', sizeUnit: 'lb',  searchTerms: ['butter', 'salted butter'] },
  { slug: 'cheese-cheddar-8oz',   name: 'Cheddar cheese block, 8 oz', departmentSlug: 'dairy', attributes: { kind: 'cheddar', form: 'block' }, sizeValue: '8', sizeUnit: 'oz', searchTerms: ['cheese', 'cheddar', 'cheddar cheese'] },
  { slug: 'yogurt-plain-32oz',    name: 'Plain yogurt, 32 oz',   departmentSlug: 'dairy',  attributes: { flavor: 'plain' },           sizeValue: '32', sizeUnit: 'oz', searchTerms: ['yogurt', 'plain yogurt'] },
  { slug: 'sour-cream-16oz',      name: 'Sour cream, 16 oz',     departmentSlug: 'dairy',  attributes: {},                            sizeValue: '16', sizeUnit: 'oz', searchTerms: ['sour cream'] },

  // Bakery
  { slug: 'bread-white-loaf',     name: 'White bread loaf, 20 oz', departmentSlug: 'bakery', attributes: { kind: 'white' },          sizeValue: '20', sizeUnit: 'oz', searchTerms: ['bread', 'white bread', 'sandwich bread'] },
  { slug: 'bread-wheat-loaf',     name: 'Wheat bread loaf, 20 oz', departmentSlug: 'bakery', attributes: { kind: 'wheat' },          sizeValue: '20', sizeUnit: 'oz', searchTerms: ['bread', 'wheat bread', 'whole wheat bread'] },
  { slug: 'buns-hamburger-8ct',   name: 'Hamburger buns, 8 ct',    departmentSlug: 'bakery', attributes: {},                          sizeValue: '8',  sizeUnit: 'ct', searchTerms: ['hamburger buns', 'burger buns'] },
  { slug: 'buns-hot-dog-8ct',     name: 'Hot dog buns, 8 ct',      departmentSlug: 'bakery', attributes: {},                          sizeValue: '8',  sizeUnit: 'ct', searchTerms: ['hot dog buns'] },

  // Produce
  { slug: 'bananas-lb',           name: 'Bananas (per lb)',        departmentSlug: 'produce', attributes: {},                         sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['bananas', 'banana'] },
  { slug: 'apples-gala-lb',       name: 'Gala apples (per lb)',    departmentSlug: 'produce', attributes: { variety: 'gala' },        sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['apples', 'gala apples'] },
  { slug: 'apples-granny-lb',     name: 'Granny Smith apples (per lb)', departmentSlug: 'produce', attributes: { variety: 'granny smith' }, sizeValue: '1', sizeUnit: 'lb', searchTerms: ['apples', 'granny smith'] },
  { slug: 'avocado-each',         name: 'Avocado (each)',          departmentSlug: 'produce', attributes: {},                         sizeValue: '1',  sizeUnit: 'ea', searchTerms: ['avocado', 'avocados'] },
  { slug: 'tomato-roma-lb',       name: 'Roma tomatoes (per lb)',  departmentSlug: 'produce', attributes: { variety: 'roma' },        sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['tomatoes', 'roma tomatoes'] },
  { slug: 'lettuce-iceberg-head', name: 'Iceberg lettuce (head)',  departmentSlug: 'produce', attributes: { variety: 'iceberg' },     sizeValue: '1',  sizeUnit: 'ea', searchTerms: ['lettuce', 'iceberg lettuce'] },
  { slug: 'spinach-baby-5oz',     name: 'Baby spinach, 5 oz',      departmentSlug: 'produce', attributes: { variety: 'baby' },        sizeValue: '5',  sizeUnit: 'oz', searchTerms: ['spinach', 'baby spinach'] },
  { slug: 'carrots-2lb-bag',      name: 'Carrots, 2 lb bag',       departmentSlug: 'produce', attributes: {},                         sizeValue: '2',  sizeUnit: 'lb', searchTerms: ['carrots'] },
  { slug: 'onion-yellow-lb',      name: 'Yellow onion (per lb)',   departmentSlug: 'produce', attributes: { color: 'yellow' },        sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['onion', 'yellow onion', 'onions'] },
  { slug: 'potatoes-russet-5lb',  name: 'Russet potatoes, 5 lb bag', departmentSlug: 'produce', attributes: { variety: 'russet' },    sizeValue: '5',  sizeUnit: 'lb', searchTerms: ['potatoes', 'russet potatoes'] },
  { slug: 'lemons-each',          name: 'Lemon (each)',            departmentSlug: 'produce', attributes: {},                         sizeValue: '1',  sizeUnit: 'ea', searchTerms: ['lemon', 'lemons'] },
  { slug: 'strawberries-16oz',    name: 'Strawberries, 16 oz',     departmentSlug: 'produce', attributes: {},                         sizeValue: '16', sizeUnit: 'oz', searchTerms: ['strawberries'] },

  // Meat
  { slug: 'ground-beef-80-20-lb', name: '80/20 ground beef (per lb)', departmentSlug: 'meat', attributes: { ratio: '80/20' },        sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['ground beef', 'hamburger', '80/20 ground beef'] },
  { slug: 'chicken-breast-boneless-lb', name: 'Boneless chicken breast (per lb)', departmentSlug: 'meat', attributes: { cut: 'breast', bone: 'boneless' }, sizeValue: '1', sizeUnit: 'lb', searchTerms: ['chicken breast', 'boneless chicken breast', 'chicken'] },
  { slug: 'bacon-12oz',           name: 'Bacon, 12 oz',            departmentSlug: 'meat',    attributes: {},                         sizeValue: '12', sizeUnit: 'oz', searchTerms: ['bacon'] },
  { slug: 'pork-chops-boneless-lb', name: 'Boneless pork chops (per lb)', departmentSlug: 'meat', attributes: { bone: 'boneless' }, sizeValue: '1', sizeUnit: 'lb', searchTerms: ['pork chops'] },

  // Pantry
  { slug: 'rice-white-long-5lb',  name: 'Long grain white rice, 5 lb', departmentSlug: 'pantry', attributes: { kind: 'long-grain', color: 'white' }, sizeValue: '5', sizeUnit: 'lb', searchTerms: ['rice', 'white rice', 'long grain rice'] },
  { slug: 'pasta-penne-1lb',      name: 'Penne pasta, 1 lb',       departmentSlug: 'pantry',   attributes: { shape: 'penne' },        sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['pasta', 'penne'] },
  { slug: 'pasta-spaghetti-1lb',  name: 'Spaghetti, 1 lb',         departmentSlug: 'pantry',   attributes: { shape: 'spaghetti' },    sizeValue: '1',  sizeUnit: 'lb', searchTerms: ['pasta', 'spaghetti'] },
  { slug: 'flour-ap-5lb',         name: 'All-purpose flour, 5 lb', departmentSlug: 'pantry',   attributes: { kind: 'all-purpose' },   sizeValue: '5',  sizeUnit: 'lb', searchTerms: ['flour', 'all purpose flour'] },
  { slug: 'sugar-granulated-4lb', name: 'Granulated sugar, 4 lb',  departmentSlug: 'pantry',   attributes: { kind: 'granulated' },    sizeValue: '4',  sizeUnit: 'lb', searchTerms: ['sugar', 'granulated sugar'] },
  { slug: 'peanut-butter-creamy-16oz', name: 'Creamy peanut butter, 16 oz', departmentSlug: 'pantry', attributes: { texture: 'creamy' }, sizeValue: '16', sizeUnit: 'oz', searchTerms: ['peanut butter', 'pb'] },
  { slug: 'jelly-grape-18oz',     name: 'Grape jelly, 18 oz',      departmentSlug: 'pantry',   attributes: { fruit: 'grape' },        sizeValue: '18', sizeUnit: 'oz', searchTerms: ['jelly', 'grape jelly'] },
  { slug: 'ketchup-32oz',         name: 'Ketchup, 32 oz',          departmentSlug: 'pantry',   attributes: {},                        sizeValue: '32', sizeUnit: 'oz', searchTerms: ['ketchup'] },
  { slug: 'mustard-yellow-14oz',  name: 'Yellow mustard, 14 oz',   departmentSlug: 'pantry',   attributes: { kind: 'yellow' },        sizeValue: '14', sizeUnit: 'oz', searchTerms: ['mustard', 'yellow mustard'] },
  { slug: 'mayo-30oz',            name: 'Mayonnaise, 30 oz',       departmentSlug: 'pantry',   attributes: {},                        sizeValue: '30', sizeUnit: 'oz', searchTerms: ['mayo', 'mayonnaise'] },
  { slug: 'olive-oil-evoo-17oz',  name: 'Extra virgin olive oil, 17 oz', departmentSlug: 'pantry', attributes: { kind: 'extra virgin' }, sizeValue: '17', sizeUnit: 'oz', searchTerms: ['olive oil', 'evoo', 'extra virgin olive oil'] },

  // Breakfast
  { slug: 'oats-rolled-18oz',     name: 'Old-fashioned rolled oats, 18 oz', departmentSlug: 'breakfast', attributes: { cut: 'rolled' }, sizeValue: '18', sizeUnit: 'oz', searchTerms: ['oats', 'oatmeal', 'rolled oats'] },

  // Beverages
  { slug: 'coffee-ground-12oz',   name: 'Ground coffee, 12 oz',    departmentSlug: 'beverages', attributes: { form: 'ground' },       sizeValue: '12', sizeUnit: 'oz', searchTerms: ['coffee', 'ground coffee'] },
  { slug: 'orange-juice-64oz',    name: 'Orange juice, 64 oz',     departmentSlug: 'beverages', attributes: {},                        sizeValue: '64', sizeUnit: 'oz', searchTerms: ['orange juice', 'oj'] },
  { slug: 'water-bottled-24pk',   name: 'Bottled water, 24 pack',  departmentSlug: 'beverages', attributes: {},                        sizeValue: '24', sizeUnit: 'ct', searchTerms: ['water', 'bottled water'] },

  // Frozen
  { slug: 'frozen-peas-12oz',     name: 'Frozen peas, 12 oz',      departmentSlug: 'frozen',   attributes: {},                         sizeValue: '12', sizeUnit: 'oz', searchTerms: ['frozen peas', 'peas'] },
  { slug: 'frozen-pizza-cheese',  name: 'Frozen cheese pizza',     departmentSlug: 'frozen',   attributes: { topping: 'cheese' },     sizeValue: null, sizeUnit: null, searchTerms: ['frozen pizza', 'cheese pizza'] },

  // Household
  { slug: 'paper-towels-6pk',     name: 'Paper towels, 6 pack',    departmentSlug: 'household', attributes: {},                        sizeValue: '6',  sizeUnit: 'ct', searchTerms: ['paper towels'] },
  { slug: 'toilet-paper-12pk',    name: 'Toilet paper, 12 pack',   departmentSlug: 'household', attributes: {},                        sizeValue: '12', sizeUnit: 'ct', searchTerms: ['toilet paper', 'tp'] },
  { slug: 'dish-soap-30oz',       name: 'Dish soap, 30 oz',        departmentSlug: 'household', attributes: {},                        sizeValue: '30', sizeUnit: 'oz', searchTerms: ['dish soap'] },
  { slug: 'laundry-detergent-50oz', name: 'Liquid laundry detergent, 50 oz', departmentSlug: 'household', attributes: { form: 'liquid' }, sizeValue: '50', sizeUnit: 'oz', searchTerms: ['laundry detergent', 'detergent'] },
];

async function main() {
  console.log(`Seeding ${CHAIN_SEEDS.length} chains...`);
  await db.insert(chains).values([...CHAIN_SEEDS]).onConflictDoNothing({ target: chains.slug });

  console.log(`Seeding ${DEPARTMENT_SEEDS.length} departments...`);
  await db.insert(departments).values([...DEPARTMENT_SEEDS]).onConflictDoNothing({ target: departments.slug });

  const allDepartments = await db.select().from(departments);
  const departmentIdBySlug = new Map(allDepartments.map((d) => [d.slug, d.id]));

  console.log(`Seeding ${GENERIC_CONCEPT_SEEDS.length} generic concepts...`);
  const conceptRows = GENERIC_CONCEPT_SEEDS.map((gc) => {
    const departmentId = departmentIdBySlug.get(gc.departmentSlug);
    if (departmentId === undefined) {
      throw new Error(`Unknown department slug: ${gc.departmentSlug}`);
    }
    return {
      slug: gc.slug,
      name: gc.name,
      departmentId,
      attributes: gc.attributes,
      sizeValue: gc.sizeValue,
      sizeUnit: gc.sizeUnit,
      searchTerms: gc.searchTerms,
    };
  });
  await db.insert(genericConcepts).values(conceptRows).onConflictDoNothing({ target: genericConcepts.slug });

  console.log('Seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
