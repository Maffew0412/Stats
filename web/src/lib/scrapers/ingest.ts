/**
 * Store-agnostic ingest: takes a normalized scrape result and writes it to the
 * database. Idempotent. Safe to run repeatedly; new prices are always appended.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  chains,
  departments,
  genericConcepts,
  prices,
  storeLocations,
  storeProductGenericMatch,
  storeProducts,
} from '../db/schema';
import type { ScrapeResult } from './types';

export interface IngestSummary {
  chainSlug: string;
  storeLocationId: string;
  productsUpserted: number;
  pricesInserted: number;
  matchesUpserted: number;
  skippedNoConcept: number;
}

export interface IngestOptions {
  /** Slug from `chains.slug`, e.g. 'target'. */
  chainSlug: string;
}

export async function ingest(
  result: ScrapeResult,
  options: IngestOptions,
): Promise<IngestSummary> {
  const chain = await db.query.chains.findFirst({
    where: eq(chains.slug, options.chainSlug),
  });
  if (!chain) {
    throw new Error(`Chain not found: ${options.chainSlug}. Run 'pnpm db:seed' first.`);
  }

  const storeLocationId = await upsertStoreLocation(chain.id, result.store);

  const allDepartments = await db.select().from(departments);
  const departmentIdBySlug = new Map(allDepartments.map((d) => [d.slug, d.id]));

  const conceptSlugs = uniq(result.products.flatMap((p) => p.matchedGenericConceptSlugs));
  const concepts =
    conceptSlugs.length === 0
      ? []
      : await db
          .select()
          .from(genericConcepts)
          .where(inArray(genericConcepts.slug, conceptSlugs));
  const conceptIdBySlug = new Map(concepts.map((c) => [c.slug, c.id]));

  let productsUpserted = 0;
  let pricesInserted = 0;
  let matchesUpserted = 0;
  let skippedNoConcept = 0;

  for (const product of result.products) {
    const knownConceptIds = product.matchedGenericConceptSlugs
      .map((slug) => conceptIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id));

    if (knownConceptIds.length === 0 && !product.upc) {
      skippedNoConcept += 1;
      continue;
    }

    const departmentId = product.departmentSlug
      ? departmentIdBySlug.get(product.departmentSlug)
      : undefined;

    const storeProductId = await upsertStoreProduct(storeLocationId, product, departmentId);
    productsUpserted += 1;

    await db.insert(prices).values({
      storeProductId,
      regularCents: product.price.regularCents,
      saleCents: product.price.saleCents ?? null,
      saleEndsOn: product.price.saleEndsOn ?? null,
    });
    pricesInserted += 1;

    if (knownConceptIds.length > 0) {
      await db
        .insert(storeProductGenericMatch)
        .values(
          knownConceptIds.map((genericConceptId) => ({
            storeProductId,
            genericConceptId,
            confidence: 'auto',
          })),
        )
        .onConflictDoNothing();
      matchesUpserted += knownConceptIds.length;
    }
  }

  return {
    chainSlug: options.chainSlug,
    storeLocationId,
    productsUpserted,
    pricesInserted,
    matchesUpserted,
    skippedNoConcept,
  };
}

async function upsertStoreLocation(
  chainId: string,
  store: ScrapeResult['store'],
): Promise<string> {
  const existing = await db.query.storeLocations.findFirst({
    where: and(
      eq(storeLocations.chainId, chainId),
      eq(storeLocations.externalId, store.externalId),
    ),
  });
  if (existing) {
    return existing.id;
  }
  const [inserted] = await db
    .insert(storeLocations)
    .values({
      chainId,
      externalId: store.externalId,
      name: store.name,
      address: store.address,
      city: store.city,
      state: store.state,
      zip: store.zip,
      lat: store.lat?.toString(),
      lng: store.lng?.toString(),
    })
    .returning({ id: storeLocations.id });
  return inserted.id;
}

async function upsertStoreProduct(
  storeLocationId: string,
  product: ScrapeResult['products'][number],
  departmentId: number | undefined,
): Promise<string> {
  const existing = await db.query.storeProducts.findFirst({
    where: and(
      eq(storeProducts.storeLocationId, storeLocationId),
      eq(storeProducts.storeSku, product.storeSku),
    ),
  });
  const now = new Date();

  if (existing) {
    await db
      .update(storeProducts)
      .set({
        name: product.name,
        brand: product.brand ?? null,
        upc: product.upc ?? null,
        sizeValue: product.sizeValue ?? null,
        sizeUnit: product.sizeUnit ?? null,
        departmentId: departmentId ?? null,
        imageUrl: product.imageUrl ?? null,
        lastSeenAt: now,
      })
      .where(eq(storeProducts.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(storeProducts)
    .values({
      storeLocationId,
      storeSku: product.storeSku,
      name: product.name,
      brand: product.brand ?? null,
      upc: product.upc ?? null,
      sizeValue: product.sizeValue ?? null,
      sizeUnit: product.sizeUnit ?? null,
      departmentId: departmentId ?? null,
      imageUrl: product.imageUrl ?? null,
      lastSeenAt: now,
    })
    .returning({ id: storeProducts.id });
  return inserted.id;
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
