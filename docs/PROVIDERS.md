# Providers

How this application gets market data.

## CS2Cap is the single dynamic data source

All dynamic market information — catalog, images, variants, providers, live
prices and price history — comes from **CS2Cap** (`https://api.cs2c.app/v1`).

**There are no direct marketplace integrations and none are planned for the
MVP.** We do not call Steam, CSFloat, Skinport, DMarket, CS.MONEY or anyone
else. Those marketplaces reach us _through_ CS2Cap, which already aggregates
around 40 of them and normalises their catalogs onto one set of item ids.

That is a deliberate trade: one upstream contract, one key, one rate limit, one
freshness model — instead of forty integrations each with its own auth, shape
and outage behaviour. Adding a direct marketplace integration requires explicit
approval (see `CLAUDE.md`).

`docs/CONCEPT.md` § 22 describes marketplaces as independent providers. That
still holds at the product level: the UI compares providers. It is the
_transport_ that is shared.

## Boundaries

```text
Svelte UI / SvelteKit routes
        ↓  normalized application types ($lib/types)
CS2Cap integration  ($lib/server/providers/cs2cap)
        ↓  CS2Cap payloads, validated with Zod
CS2Cap API
```

Everything lives under `src/lib/server/providers/cs2cap/`:

| File           | Responsibility                                                |
| -------------- | ------------------------------------------------------------- |
| `client.ts`    | Base URL, bearer auth, query building, timeout, `CS2CapError` |
| `schemas.ts`   | Zod schemas for every response we consume                     |
| `items.ts`     | Catalog search and lookups, catalog filter metadata           |
| `providers.ts` | Marketplace directory                                         |
| `prices.ts`    | Live lowest asks                                              |
| `history.ts`   | OHLC price history                                            |
| `mappers.ts`   | CS2Cap payloads → our domain types (pure)                     |

Raw CS2Cap field names (`lowest_ask`, `market_hash_name`, `is_stattrak`,
`rarity_color`, `item_id`) appear **only** inside this folder and its tests.
Everything above the boundary speaks `Skin`, `SkinVariant`, `MarketQuote`,
`MarketProvider` and `PriceHistory` from `src/lib/types/`.

The API key is read from `$env/dynamic/private` inside `client.ts` and never
leaves the server. `$lib/server/**` cannot be imported by browser code.

## Endpoints used

| Endpoint              | Used for                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `GET /items`          | Catalog search, lookup by item id, lookup by market hash name, full variant set for one skin |
| `GET /items/metadata` | Filter vocabulary — weapon types, wears, rarities, collections, styles                       |
| `GET /providers`      | Marketplace directory: key, display name, logo, market type, health                          |
| `GET /prices`         | Live lowest asks per provider for one item                                                   |
| `POST /prices/batch`  | Live lowest asks for several items in one request — kit pricing, when enabled                |
| `GET /prices/candles` | Composite OHLC price history                                                                 |

Nothing else is called. `/bids`, `/sales`, `/market/*`, `/portfolio`,
`/inventory` and the streaming endpoints are out of scope.

## Rules that shape the integration

**Currency: BRL.** Product-facing price requests send `currency=BRL` and CS2Cap
does the conversion. We never implement FX ourselves. The currency travels with
the data (`MarketQuote.currency`, `PriceHistory.currency`) rather than being
assumed, so a second currency later is a parameter change, not a refactor.

**Minor units.** Every money value is an integer in the currency's minor unit:
`14250` with `BRL` is R$ 142,50. No floats, no division, no rounding anywhere in
the data layer — a price is only converted to a decimal at the moment it is
rendered. Floating-point money is how comparison tables start disagreeing with
themselves.

**Lowest ask, not "price".** `MarketQuote.priceMinor` is the cheapest
_currently listed_ offer on that provider. It is not an average, a last sale, a
fair value or a market valuation, and it must never be labelled as one.

**Stale prices are excluded by default.** CS2Cap flags a listing `stale` when
its most recent scan of that provider did not include it — the price is the last
one seen and may be gone. Price requests send `exclude_stale=true` so a
comparison never ranks an offer that may not exist. The flag still travels on
`MarketQuote.stale` for any view that deliberately shows older data.

**Item ids are the identity.** Prices and history are keyed on CS2Cap's
`item_id`. Normalisation preserves it on every `SkinVariant`; the skin slug is a
URL label, not an identifier.

**Variant grouping.** Upstream, each exterior/StatTrak/Souvenir combination is
its own catalog entry. `groupItemsIntoSkins` regroups them by base name + finish
name into one product-level `Skin`, with each combination kept as a distinct
variant carrying its own `itemId`. Grouping is scoped to the entries passed in,
so a paginated search can return a partially-populated skin — `getSkinByName`
fetches the complete set.

**No listing-level float work.** Active-listing float search, exact float
filters, inspect links, paint seeds, sticker valuation and per-listing objects
are all out of scope. Wear stays useful as the _variant_ dimension; the product
compares prices, not individual listings.

## Plan limitations

The integration targets the constraints of the free/starter tier:

- **History**: `interval=1d` only, lookback capped at 30 whole days. `history.ts`
  clamps to those defaults; asking for more returns `403`, not a shorter series.
- **Raw marketplace URLs**: the `url` field (direct listing link) is paid-tier
  only and is omitted entirely on free tier. We map only `link`, the tracked
  redirect available on every tier, onto `MarketQuote.redirectUrl`.
- **Batch lookups**: `POST /prices/batch` needs Starter or above. On a plan
  without it, upstream answers `403`. See **Multi-item pricing** below.

_Plan boundaries recorded from the published pricing guide on 2026-09-22._

- **Rate limits**: per-minute and monthly quotas apply. A `429` surfaces as a
  retryable `CS2CapError` carrying `retryAfterSeconds`.
- Per-provider price history, bids, sales and market analytics are paid-tier
  endpoints and are not integrated.

## Multi-item pricing

A kit needs a price for each of its items. There are two ways to get them, and
which one runs is **configuration**, never a guess:

```bash
CS2CAP_BATCH_PRICES_ENABLED=false   # default — bounded individual requests
CS2CAP_BATCH_PRICES_ENABLED=true    # one POST /prices/batch per kit
```

Server-only, and deliberately not a `PUBLIC_` variable: which upstream
endpoints a deployment may call is infrastructure, and it is not the browser's
business. It is operational configuration rather than a secret, but the same
rule applies — nothing about the provider goes to the client.

**No probing.** "Try batch, catch the 403, fall back forever" would turn a
misconfigured deployment into a permanent silent regression that nobody ever
notices. If batch is switched on and upstream refuses, the request fails, the
`CS2CapError` stays diagnosable server-side, and the market section of the page
degrades calmly. The product never pretends the configuration is correct.

|                       | Individual (default)                                | Batch                                     |
| --------------------- | --------------------------------------------------- | ----------------------------------------- |
| Requests per cold kit | one per item, at most 4 concurrent                  | one                                       |
| Cache                 | the existing per-item entry, shared with skin pages | one whole-kit entry                       |
| Failure granularity   | per item — one failure leaves the rest priced       | whole request                             |
| Tracked offer links   | yes (`link`)                                        | **no** — the contract has no `link` field |

Both produce the same `SkinMarketPrices`: BRL, stale excluded, cheapest first,
`bestQuote` picked. A caller cannot tell which ran. A test pins that, over a
real socket, against the same stub the end-to-end suite uses.

**Individual mode is bounded**, at four concurrent requests. Kits hold at most
eight items, and an unbounded `Promise.all` would spend the whole per-minute
burst allowance on a single page. It reuses `getSkinPrices`, so a kit and the
skin pages it links to share cache entries: opening a kit warms all of them.

**Batch results are cached whole**, under a key built from the sorted unique
item ids plus currency and stale handling — so a reordered kit is the same
request. They are deliberately **not** split into per-item entries: that would
let a later single-item lookup serve a value fetched under different
parameters, and the gain (a warm skin page after opening a kit) is not worth
blurring which request produced which cached value. Same five-minute TTL as
every other price; there is no second lifetime to reason about.

The one product-visible difference is the offer link. The batch contract
carries no `link`, and a redirect URL is not something to construct from a
pattern — so in batch mode a plan line shows its price without a "View offer"
button. Fabricating a marketplace URL would be worse than omitting one.

## Prices in catalog grids

**Explore deliberately loads no prices.** A page of 24 skins would be 24
`GET /prices` calls, and paging through the catalog would burn the monthly
quota in minutes. So catalog browsing is catalog-only, and prices appear on a
skin's own page where exactly one item is in question.

`POST /prices/batch` looks up to 100 items in one request and is the right tool
for grid price enrichment — it needs Starter or above, which the current plan
may not include. When that is available, enrich a grid with **one batch request
per page**, never one per card. The integration exists today (see **Multi-item
pricing**); pointing Explore at it is a separate product decision, because a
grid of 24 priced cards is a different page from a grid of 24 catalog cards.

`/kits` follows the same rule as Explore and loads no prices at all. A kit is
priced only when someone opens it.

Until then, a card without a price is showing the truth: no price was asked
for. That is a different state from a price that was looked for and not found,
and the UI keeps them apart.

## Skin details request pattern

One skin page makes at most four upstream calls, all cached:

| Call                                            | Cache      |
| ----------------------------------------------- | ---------- |
| Catalog index (shared with Explore)             | 6 hours    |
| `GET /providers`                                | 10 minutes |
| `GET /prices` for the **selected variant only** | 5 minutes  |
| `GET /prices/candles` for the same variant      | 30 minutes |

**Never prefetch every variant's prices.** A skin has around eleven variants; loading
all of them would be eleven requests against a metered quota for ten the visitor may
never open. Switching variant is a navigation, and that navigation fetches one.

There is no polling and no manual refresh: upstream refreshes every few minutes and
our own price cache is five, so a refresh button would mostly re-read the cache.

## Catalog index

Explore does not page through `/items` directly. CS2Cap pages over _catalog
entries_ — roughly eleven per skin, one per exterior and special finish — and
exposes no sort parameter, so paging that way would give variable page sizes, a
total that counts exteriors rather than skins, and sorting that only covered
the current page.

Instead the weapon catalog is fetched **once** (`/items?item_type=Weapon`, a
single ~20MB response covering ~21,500 entries), grouped into ~1,970
product-level skins and cached for six hours. Every filter, sort and page is
then answered from memory in milliseconds, with honest totals and complete
variant sets.

The trade-off is a slow first request after the cache expires (around five
seconds) and the memory the index occupies. That is acceptable for a long-lived
Node process; a serverless deployment paying it per cold start would want a
shared cache, which is a deployment-phase decision.

`CS2CAP_BASE_URL` can point the integration at a stub, which is how the
end-to-end suite runs without a key or a network.

## Errors

`CS2CapError` carries a `kind` that callers branch on: `config`, `auth`,
`forbidden`, `not_found`, `rate_limit`, `unavailable`, `invalid_response`,
`upstream`. `retryable` is true for `unavailable` and `rate_limit`.

A `200` that fails Zod validation is an error (`invalid_response`), not data.
Errors carry the upstream status and error code but never the API key, the
Authorization header or the request body — a `CS2CapError` is safe to log.

## Diagnostics

`GET /api/dev/cs2cap?q=<name>` exercises catalog → variants → quotes →
providers → history and returns normalized data only. It responds **404 outside
`dev`**, has no UI, and is not a product endpoint.

## Caching

Every service-level CS2Cap call goes through the process-local TTL cache in
`src/lib/server/cache/`. The plan's monthly quota is finite, so the cache is
quota protection as much as it is latency work.

| Data                  | TTL        |
| --------------------- | ---------- |
| Catalog item / detail | 1 hour     |
| Catalog search        | 15 minutes |
| Catalog metadata      | 6 hours    |
| Providers             | 10 minutes |
| Prices                | 5 minutes  |
| Price history         | 30 minutes |

Concurrent requests for the same key are coalesced into a single upstream call,
and failures — 401, 429, timeouts, malformed payloads — are never cached, so a
rate-limited minute does not become a cached outage. The cache is bounded,
in-memory, and not distributed; see `docs/ARCHITECTURE.md` for the full rules.
No Redis, no database, no persistent cache.

**Our cache age is not CS2Cap's `stale` flag.** `stale` is upstream's statement
that its latest scan did not see a listing. Our TTL is our own statement about
how long we will serve what we already fetched. A cached quote stays valid
while its TTL holds, and its `stale` flag is never recomputed from cache age.
