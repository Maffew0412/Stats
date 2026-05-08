/**
 * Rosie tenant map.
 *
 * Rosie (https://rosie.com / rosieapp.com) is a white-label e-commerce
 * platform used by many regional independent grocers, including Niemann
 * Foods' County Market and Harvest Market banners. Each tenant is hosted
 * under a chain-specific subdomain, with a path-segment store slug.
 *
 * Example URLs we've seen:
 *   https://shop.goharvestmarket.com/store/niemann-harvest-market/storefront
 *
 * IMPORTANT — verification needed:
 * The County Market store slug is a best-guess from the Niemann Foods naming
 * pattern; verify by visiting shop.countymarket.com (or the chain's
 * "Order Online" link) and capturing the storefront URL before live use.
 */

export interface RosieTenant {
  /** The chain slug we identify this tenant by in our DB. */
  chainSlug: string;
  /** Public host serving this tenant (white-labeled per chain). */
  host: string;
  /** Path-segment slug Rosie uses for this tenant. */
  storeSlug: string;
}

export const ROSIE_TENANTS: Record<string, RosieTenant> = {
  'county-market': {
    chainSlug: 'county-market',
    host: 'shop.countymarket.com',
    storeSlug: 'niemann-county-market',
  },
  'harvest-market': {
    chainSlug: 'harvest-market',
    host: 'shop.goharvestmarket.com',
    storeSlug: 'niemann-harvest-market',
  },
};

export function tenantFor(chainSlug: string): RosieTenant {
  const t = ROSIE_TENANTS[chainSlug];
  if (!t) {
    throw new Error(
      `No Rosie tenant configured for chain '${chainSlug}'. Known: ${Object.keys(
        ROSIE_TENANTS,
      ).join(', ')}`,
    );
  }
  return t;
}
