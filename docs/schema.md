# Database Schema — MVP

PostgreSQL. All tables live in the default schema. UUID primary keys.
Money is stored as integer cents.

## Design Notes

A **store SKU** is a specific product at a specific store location (e.g., "Schnucks 2% Milk Gallon at Schnucks #730"). Every SKU may carry:

- a **UPC** (when the product is a recognized branded item) — used for *brand-specific* matching
- one or more **generic concept** tags (e.g., "2% milk, 1 gallon") — used for *generic* matching

A SKU may be linked to neither (uncrosswalked), one, or both. The two layers of matching run independently:

- **Branded intent** lookup → find SKUs with the same UPC across stores.
- **Generic intent** lookup → find the cheapest SKU at each store tagged with the requested concept.

This keeps the canonical taxonomy decoupled from store catalogs: scrapers populate `store_products` and `prices` daily; the crosswalk (`store_product_generic_match`) is a separate, slower-changing content layer that we hand-curate or generate via LLM-assisted matching.

---

## Reference Data

```sql
CREATE TABLE chains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,           -- 'aldi', 'target', 'rosie-county-market'
  name          TEXT NOT NULL,                  -- 'Aldi', 'Target', 'County Market'
  scraper_key   TEXT NOT NULL,                  -- module name in the worker
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id      UUID NOT NULL REFERENCES chains(id),
  external_id   TEXT NOT NULL,                  -- store number used by the chain's site/API
  name          TEXT NOT NULL,                  -- 'Schnucks - Wabash Ave'
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         CHAR(2) NOT NULL,
  zip           TEXT NOT NULL,
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, external_id)
);

CREATE TABLE departments (
  id    SMALLSERIAL PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,                   -- 'produce', 'dairy', 'frozen', ...
  name  TEXT NOT NULL
);
```

## Canonical Taxonomy

```sql
-- Generic concepts: "2% milk, 1 gallon", "white bread loaf, 20oz", "bananas, lb"
CREATE TABLE generic_concepts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,           -- 'milk-2pct-gallon'
  name          TEXT NOT NULL,                  -- '2% milk, 1 gallon'
  department_id SMALLINT REFERENCES departments(id),
  attributes    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"fat":"2%","kind":"cow"}
  size_value    NUMERIC,                        -- 1
  size_unit     TEXT,                           -- 'gal'
  search_terms  TEXT[],                         -- ['milk','2 percent','two percent milk']
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX generic_concepts_search_terms_gin ON generic_concepts USING GIN (search_terms);
```

## Per-Store Catalog

```sql
CREATE TABLE store_products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_location_id     UUID NOT NULL REFERENCES store_locations(id),
  store_sku             TEXT NOT NULL,          -- the chain's internal product id
  name                  TEXT NOT NULL,
  brand                 TEXT,
  upc                   TEXT,                   -- 12-14 digit string when known
  size_value            NUMERIC,
  size_unit             TEXT,                   -- 'oz', 'lb', 'ct', 'gal'
  department_id         SMALLINT REFERENCES departments(id),
  image_url             TEXT,
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_location_id, store_sku)
);

CREATE INDEX store_products_upc        ON store_products(upc) WHERE upc IS NOT NULL;
CREATE INDEX store_products_location   ON store_products(store_location_id);

-- Many-to-many: which store products satisfy which generic concepts.
-- A 1-gallon 2% milk SKU might match 'milk-2pct-gallon' AND 'milk-any-gallon'.
CREATE TABLE store_product_generic_match (
  store_product_id      UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  generic_concept_id    UUID NOT NULL REFERENCES generic_concepts(id) ON DELETE CASCADE,
  confidence            TEXT NOT NULL,          -- 'manual' | 'auto' | 'verified'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_product_id, generic_concept_id)
);
```

## Pricing (Time Series)

```sql
-- Append-only: every scrape pass writes a row per SKU. Lets us trivially answer
-- "what was today's price?" and (later) "show price history."
CREATE TABLE prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id  UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  regular_cents     INTEGER NOT NULL,
  sale_cents        INTEGER,                    -- NULL when not on sale
  sale_ends_on      DATE,                       -- best-effort from store data
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX prices_product_captured ON prices(store_product_id, captured_at DESC);

-- Convenience view for the latest price per SKU (used by the comparison query path).
CREATE VIEW current_prices AS
SELECT DISTINCT ON (store_product_id)
       store_product_id,
       regular_cents,
       sale_cents,
       sale_ends_on,
       captured_at
FROM prices
ORDER BY store_product_id, captured_at DESC;
```

## Users, Devices, Lists

Anonymous-first. A `device` is the unit of identity for a fresh visitor; a `user` is created lazily when they choose Save & Sync.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_token    TEXT NOT NULL UNIQUE,           -- stored client-side in localStorage
  user_id       UUID REFERENCES users(id),      -- NULL until claimed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's selected stores + ZIP for comparison.
CREATE TABLE user_preferences (
  device_id                 UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  zip                       TEXT,
  selected_chain_ids        UUID[] NOT NULL DEFAULT '{}',
  allow_substitutions       BOOLEAN NOT NULL DEFAULT false,
  preferred_location_ids    UUID[] NOT NULL DEFAULT '{}'  -- one location per chain
);

CREATE TABLE lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'My list',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE list_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id               UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  intent                TEXT NOT NULL CHECK (intent IN ('generic', 'branded')),
  generic_concept_id    UUID REFERENCES generic_concepts(id),  -- when intent='generic'
  upc                   TEXT,                                  -- when intent='branded'
  raw_query             TEXT NOT NULL,                         -- whatever the user typed
  quantity              NUMERIC NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (intent = 'generic' AND generic_concept_id IS NOT NULL AND upc IS NULL)
    OR
    (intent = 'branded' AND upc IS NOT NULL AND generic_concept_id IS NULL)
  )
);
```

## Comparison Query Sketch

For a list of N items × 8 stores, the result is the per-store basket total + the unavailable-item count. Outline:

```sql
-- For each list item, find the cheapest qualifying current price at each
-- of the user's selected store locations. Generic-intent items match via
-- store_product_generic_match; branded-intent items match via UPC.
-- Aggregate per store_location to get totals; flag items with no match.
```

The full query is order ~50 lines and doesn't belong in this doc — we'll write it as a Postgres function or as a Drizzle/Prisma query when we wire up the API route.

## Indexes / Performance Notes

- `prices` will grow ~ (8 stores × ~50k SKUs × 1 row/day) = ~400k rows/day. After 1 year that's ~150M rows. Partition by month if/when this becomes a problem; not needed at MVP scale.
- `store_products.upc` is the hot path for branded-intent matching → indexed.
- `store_product_generic_match` is the hot path for generic-intent matching → primary key covers it.
- Add a GIN index on `store_products.name` (trigram) once we have free-text search in the list builder UI.

## Migration Plan

- Use a single migration tool consistently — recommend **Drizzle Kit** (Next.js-native, TypeScript-first), but Prisma is also fine.
- Seed scripts: chains + Springfield store_locations + departments + an initial set of generic_concepts (start with ~50 of the most common items, grow from there).
