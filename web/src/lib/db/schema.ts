import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  smallserial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const chains = pgTable('chains', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  scraperKey: text('scraper_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const storeLocations = pgTable(
  'store_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chainId: uuid('chain_id')
      .notNull()
      .references(() => chains.id),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    state: char('state', { length: 2 }).notNull(),
    zip: text('zip').notNull(),
    lat: numeric('lat', { precision: 9, scale: 6 }),
    lng: numeric('lng', { precision: 9, scale: 6 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('store_locations_chain_external').on(t.chainId, t.externalId)],
);

export const departments = pgTable('departments', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const genericConcepts = pgTable(
  'generic_concepts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    departmentId: smallint('department_id').references(() => departments.id),
    attributes: jsonb('attributes').notNull().default({}),
    sizeValue: numeric('size_value'),
    sizeUnit: text('size_unit'),
    searchTerms: text('search_terms').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('generic_concepts_search_terms_gin').using('gin', t.searchTerms),
  ],
);

export const storeProducts = pgTable(
  'store_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeLocationId: uuid('store_location_id')
      .notNull()
      .references(() => storeLocations.id),
    storeSku: text('store_sku').notNull(),
    name: text('name').notNull(),
    brand: text('brand'),
    upc: text('upc'),
    sizeValue: numeric('size_value'),
    sizeUnit: text('size_unit'),
    departmentId: smallint('department_id').references(() => departments.id),
    imageUrl: text('image_url'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('store_products_location_sku').on(t.storeLocationId, t.storeSku),
    index('store_products_upc').on(t.upc).where(sql`${t.upc} IS NOT NULL`),
    index('store_products_location').on(t.storeLocationId),
  ],
);

export const storeProductGenericMatch = pgTable(
  'store_product_generic_match',
  {
    storeProductId: uuid('store_product_id')
      .notNull()
      .references(() => storeProducts.id, { onDelete: 'cascade' }),
    genericConceptId: uuid('generic_concept_id')
      .notNull()
      .references(() => genericConcepts.id, { onDelete: 'cascade' }),
    confidence: text('confidence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storeProductId, t.genericConceptId] })],
);

export const prices = pgTable(
  'prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeProductId: uuid('store_product_id')
      .notNull()
      .references(() => storeProducts.id, { onDelete: 'cascade' }),
    regularCents: integer('regular_cents').notNull(),
    saleCents: integer('sale_cents'),
    saleEndsOn: date('sale_ends_on'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('prices_product_captured').on(t.storeProductId, t.capturedAt.desc()),
  ],
);

export const currentPrices = pgView('current_prices', {
  storeProductId: uuid('store_product_id').notNull(),
  regularCents: integer('regular_cents').notNull(),
  saleCents: integer('sale_cents'),
  saleEndsOn: date('sale_ends_on'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
}).as(
  sql`SELECT DISTINCT ON (store_product_id)
        store_product_id, regular_cents, sale_cents, sale_ends_on, captured_at
      FROM prices
      ORDER BY store_product_id, captured_at DESC`,
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  anonToken: text('anon_token').notNull().unique(),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  deviceId: uuid('device_id')
    .primaryKey()
    .references(() => devices.id, { onDelete: 'cascade' }),
  zip: text('zip'),
  selectedChainIds: uuid('selected_chain_ids').array().notNull().default(sql`'{}'::uuid[]`),
  allowSubstitutions: boolean('allow_substitutions').notNull().default(false),
  preferredLocationIds: uuid('preferred_location_ids').array().notNull().default(sql`'{}'::uuid[]`),
});

export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My list'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listItems = pgTable(
  'list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    intent: text('intent').notNull(),
    genericConceptId: uuid('generic_concept_id').references(() => genericConcepts.id),
    upc: text('upc'),
    rawQuery: text('raw_query').notNull(),
    quantity: numeric('quantity').notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('list_items_intent_check', sql`${t.intent} IN ('generic', 'branded')`),
    check(
      'list_items_intent_targets_check',
      sql`(${t.intent} = 'generic' AND ${t.genericConceptId} IS NOT NULL AND ${t.upc} IS NULL)
          OR (${t.intent} = 'branded' AND ${t.upc} IS NOT NULL AND ${t.genericConceptId} IS NULL)`,
    ),
  ],
);
