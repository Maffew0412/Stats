/**
 * Scrape runner.
 *
 * Usage:
 *   pnpm scrape <chain-slug> [--zip=62704] [--dry-run]
 *
 * Examples:
 *   pnpm scrape target --dry-run         # exercise pipeline against fixtures
 *   pnpm scrape target --zip=62704       # live run against Target's RedSky
 *
 * In --dry-run mode, --print emits the normalized scrape result to stdout
 * instead of writing to the database. Useful for sanity checks without a DB.
 */

import 'dotenv/config';
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scraper = getScraper(args.chainSlug);

  console.log(
    `Scraping ${args.chainSlug} (zip=${args.zip}, dryRun=${args.dryRun}, printOnly=${args.printOnly})`,
  );
  const result = await scraper.scrape({ zip: args.zip, dryRun: args.dryRun });
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
