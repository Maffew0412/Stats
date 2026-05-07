# Grocery Price Comparison — MVP Spec

## Problem & Value Proposition

Consumers in mid-sized US markets typically shop at 1–2 grocery stores out of habit, leaving real money on the table because they can't easily compare a full cart across local options. This app lets a shopper enter their grocery list once and see which **single store** offers the cheapest total today — saving money without adding driving time.

**Pitch:** *"One list. One stop. Best price. Built for Springfield."*

## Target User (MVP)

- Springfield, IL households (population ~115k, ~50k households)
- Primary persona: cost-conscious household shopper planning a weekly trip
- Mobile-first behavior (list-building at home, comparison checked before leaving)

## Geographic Scope

- **Launch market:** Springfield, IL (ZIP range 627xx)
- Single metro for MVP; expansion deferred until product validates

## Store Coverage (8 chains)

| Store | Data source | Difficulty |
|---|---|---|
| Target | RedSky internal API | Easy |
| Walmart | walmart.com (scrape) | Medium |
| Meijer | meijer.com online catalog | Medium |
| Hy-Vee | hyvee.com Aisles Online | Medium |
| Schnucks | schnucks.com online catalog | Medium |
| Aldi | aldi.us curbside pickup catalog | Medium |
| County Market | Rosie platform (shop.countymarket.com) | Medium |
| Harvest Market | Rosie platform (shop.goharvestmarket.com) | Medium |

A single Rosie scraper covers both County Market and Harvest Market, and is reusable for future regional expansion.

## Data Pipeline

- **Refresh cadence:** every 24 hours, all stores, full catalog
- **Storage:** normalized product catalog keyed on UPC (branded items) or canonical concept ID (generic items / store brands)
- **Per-store crosswalk:** each store SKU mapped to a canonical product node
- **Sale capture:** if the store surfaces a sale price + end date in its catalog, both are stored and shown in the UI

## Matching Logic

Two-tier intent model, with intent inferred at list-add time and overridable per item:

- **Generic intent** (e.g., "milk," "eggs," "bread," "bananas"): app picks the cheapest qualifying product at each store, matched on canonical concept (e.g., *2% milk, 1 gallon*)
- **Brand-specific intent** (e.g., "Cheerios," "Heinz Ketchup"): app matches the exact UPC across stores

The chosen SKU is always shown to the user in the basket detail view, so substitutions are transparent.

## Optimization Strategy

**Single-store winner.** The app recommends the one store with the cheapest total for the user's full list. Split-list optimization ("buy half here, half there") is deferred to v2.

**Unavailable items:** if the winning store doesn't carry an item, the item is shown as *"not available — pick up elsewhere"* in the basket detail. The store is **not** disqualified, and the app does **not** auto-substitute by default.

**Substitution toggle:** a per-list opt-in setting allows the app to suggest the closest equivalent (e.g., Aldi Millville Toasted Oats for Cheerios) with a clear "substitution" badge. Off by default.

## Sales Handling

- Today's effective price is always used in totals
- Items currently on sale display a "Sale ends [date]" badge in the basket detail view
- No date-shifting / "shop on Wednesday" feature in MVP

## Platform

**Responsive web app (PWA)** for MVP. Reasons:

- Fastest iteration; no app-store review cycle
- Zero install friction (shareable URL; "Add to Home Screen" on iOS/Android)
- One codebase
- No v1 features require native APIs

Native wrapper (Capacitor or React Native) deferred until product is validated and barcode scanning / push notifications become priorities.

## Core User Flow (5 screens)

1. **Onboarding (one time)** — enter ZIP, select which of the 8 stores to include in comparisons. No account required.
2. **List Builder (home)** — autocomplete input from common-items dictionary; each list item shows quantity + intent badge (generic / brand-specific) which is one-tap toggleable. CTA: "Compare prices."
3. **Comparison Results** — hero card for the winning store with total + savings vs. next-best; sortable list of all selected stores with totals, sale badges, and unavailable-item counts.
4. **Basket Detail (per store)** — itemized list showing each user item → matched SKU → price → size; unavailable items called out; substitution toggle accessible here.
5. **Shopping Mode** — tap "Shop at [store]" to convert the list into a checkable shopping list grouped by department (produce, dairy, frozen, etc.). Running total updates as items are checked.

## Accounts

- **MVP:** anonymous, local-storage only. List persists per-device with no sign-up.
- Optional **"Save & Sync"** action creates an account on demand (cross-device sync, share with household). Not required to use core features.

## Explicitly Out of Scope for MVP

- Split-list / multi-store optimization
- Aisle-level ordering in shopping mode (departments only)
- In-store barcode scanning
- Price history / charts
- Coupons & loyalty card integration
- Push notifications
- Independent / non-chain grocers
- Receipt scanning / crowdsourced prices
- Markets outside Springfield, IL

## Open Questions / Risks

- **Aldi pickup price parity:** confirm aldi.us pickup prices match in-store shelf prices for a Springfield store before committing the scraper
- **Scraping ToS exposure:** review each chain's terms of service; budget for resilience to anti-bot measures
- **Canonical taxonomy bootstrapping:** building the generic-product graph (and the store-brand equivalence layer) is the largest upfront content effort
- **Business model:** undecided (ad-supported, affiliate, or freemium) — does not block MVP build but should be settled before launch

## Success Criteria for MVP

- 8 stores live with daily-refreshed pricing for a ~500-item common-product catalog
- A user can build a 20-item list and see a comparison in under 30 seconds
- Returning-user rate > 30% within 2 weeks of first use (signal that the comparison is delivering real value)
