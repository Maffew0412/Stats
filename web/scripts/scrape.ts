/**
 * Scrape runner.
 *
 * Usage:
 *   pnpm scrape <chain-slug> [--zip=62704] [--dry-run] [--print]
 *
 * Examples:
 *   pnpm scrape target --dry-run            # offline pipeline test against fixtures
 *   pnpm scrape target --zip=62704          # live run against Target's RedSky
 *   pnpm scrape county-market --dry-run     # routes through the shared 'rosie' scraper
 *
 * The CLI takes a CHAIN slug, then resolves it to a SCRAPER key via
 * CHAIN_SEEDS so multi-tenant scrapers (Rosie hosts both County Market and
 * Harvest Market) can share one module while still being addressable per-chain.
 *
 * In --dry-run mode, --print emits the normalized scrape result to stdout
 * instead of writing to the database. Useful for sanity checks without a DB.
 */

import 'dotenv/config';
import { CHAIN_SEEDS } from '../src/lib/catalog/seeds';
import { getScraper, listScrapers } from '../src/lib/scrapers';
import { ingest } from '../src/lib/scrapers/ingest';

interface Args {
  chainSlug: string;
  zip: string;
  dryRun: boolean;
  printOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      flags.set(k, v ?? 'true');
    } else {
      positional.push(a);
    }
  }
  const chainSlug = positional[0];
  if (!chainSlug) {
    console.error(
      `Usage: pnpm scrape <chain-slug> [--zip=62704] [--dry-run] [--print]`,
    );
    console.error(
      `Known chains: ${CHAIN_SEEDS.map((c) => c.slug).join(', ')}`,
    );
    console.error(`Known scrapers: ${listScrapers().join(', ')}`);
    process.exit(2);
  }
  return {
    chainSlug,
    zip: flags.get('zip') ?? '62704',
    dryRun: flags.get('dry-run') === 'true',
    printOnly: flags.get('print') === 'true',
  };
}

function chainScraperKey(chainSlug: string): string | null {
  const c = CHAIN_SEEDS.find((c) => c.slug === chainSlug);
  return c?.scraperKey ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const scraperKey = chainScraperKey(args.chainSlug);
  if (!scraperKey) {
    console.error(`Unknown chain '${args.chainSlug}'.`);
    console.error(
      `Known chains: ${CHAIN_SEEDS.map((c) => c.slug).join(', ')}`,
    );
    process.exit(2);
  }
  const scraper = getScraper(scraperKey);

  console.log(
    `Scraping ${args.chainSlug} via '${scraperKey}' scraper (zip=${args.zip}, dryRun=${args.dryRun}, printOnly=${args.printOnly})`,
  );
  const result = await scraper.scrape({
    zip: args.zip,
    dryRun: args.dryRun,
    chainSlug: args.chainSlug,
  });
  console.log(
    `Located store ${result.store.name} (${result.store.externalId}) and pulled ${result.products.length} products.`,
  );

  if (args.printOnly) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const summary = await ingest(result, { chainSlug: args.chainSlug });
  console.log('Ingest summary:', summary);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Scrape failed:', err);
    process.exit(1);
  });
