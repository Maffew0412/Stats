import type { Scraper } from './types';
import { targetScraper } from './target/scrape';

const SCRAPERS: Record<string, Scraper> = {
  [targetScraper.key]: targetScraper,
};

export function getScraper(key: string): Scraper {
  const scraper = SCRAPERS[key];
  if (!scraper) {
    throw new Error(
      `Unknown scraper '${key}'. Known: ${Object.keys(SCRAPERS).join(', ')}`,
    );
  }
  return scraper;
}

export function listScrapers(): string[] {
  return Object.keys(SCRAPERS);
}
