# Architecture

Conventions for this codebase. We are establishing shared defaults, not building an
enterprise framework — when in doubt, pick the simpler option.

## SvelteKit responsibilities

SvelteKit owns routing, server-side rendering, data loading and form handling.

**SSR-first.** Pages render on the server by default. That is not negotiable for a
product whose value is discovery: skin and price pages must be indexable and must
paint useful content on first byte. `export const ssr = false` needs a concrete,
stated reason.

The data a page needs to render belongs in a `+page.server.ts` / `+page.ts` `load`
function. TanStack Query does not replace it.

The adapter is `@sveltejs/adapter-auto` — deliberately provider-agnostic until a
deployment target is chosen. Swap it then, not before.

## Svelte 5 state model

Runes only for new code:

- `$state` — owned, mutable UI state.
- `$derived` — anything computable from other state. **Derive, never duplicate.**
  A total price, a filtered list, a "is anything selected" flag: all `$derived`.
- `$effect` — synchronising with something outside Svelte (DOM APIs, subscriptions,
  timers, a GSAP timeline). Not for deriving values, and not for keeping two pieces
  of state in sync — that is a modelling mistake.

Reusable rune-based state goes in a `.svelte.ts` module under `src/lib/state/`
(app-wide) or inside the feature that owns it. There is **no global store library**
and none will be added.

## Server state vs local UI state

| Kind                                                                 | Where it lives                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Data that exists on a server (skins, prices, history, user loadouts) | SvelteKit `load` for first render; TanStack Query for client-side reads/refetches |
| Ephemeral UI state (open/closed, selected tab, draft filter)         | `$state` in the component                                                         |
| Shared UI state across a feature                                     | A `.svelte.ts` rune module                                                        |
| URL-worthy state (filters, search terms, pagination)                 | **The URL.** Filters are shareable; keep them in query params                     |

The query client is configured in `src/lib/api/query-client.ts`: 60s default stale
time, two retries with capped backoff, no refetch on window focus. It is created
**per request** by the root layout — a module-level singleton would leak one
visitor's cache into another visitor's SSR render.

TanStack Query is for synchronisation, not architecture: polling a price, refreshing
a comparison in the background, paginating a grid, optimistic wishlist updates.

**TanStack Query must not turn this into a client-only SPA.** The division of labour:

| SvelteKit owns                          | TanStack Query owns               |
| --------------------------------------- | --------------------------------- |
| SSR and first paint                     | Client-side caching               |
| Routing                                 | Refetching and background refresh |
| Server-side data loading                | Client-side server state          |
| Metadata, SEO, OpenGraph                | Interactive data refresh          |
| Server boundaries and protected secrets | Optimistic updates                |

Pick one per piece of data. Do not fetch the same thing in a `load` function _and_
again through a query on mount — either hand the loaded data to the query as initial
data, or let `load` own it outright.

## External data

**Dynamic market information comes from real external APIs.** Prices, marketplace
listings, availability, offer counts, price history and market metadata are fetched
from upstream, not from files we author.

Local JSON is **not** the source of dynamic market data. There is no `prices.json`
and there will not be one. Do not create fake market datasets to stand in for an
integration that has not been built — an unbuilt feature stays unbuilt.

**CS2Cap is the single dynamic data source for the MVP.** It aggregates ~40
marketplaces, so we integrate one upstream instead of forty. No marketplace is
called directly, and adding one needs explicit approval. Full detail in
[`docs/PROVIDERS.md`](PROVIDERS.md).

```text
Svelte UI / SvelteKit routes
        ↓  normalized application types ($lib/types)
CS2Cap integration  ($lib/server/providers/cs2cap)
        ↓  CS2Cap payloads, validated with Zod
CS2Cap API
```

The integration lives entirely in `src/lib/server/providers/cs2cap/` —
`client.ts` (auth, timeout, errors), `schemas.ts` (Zod), `items.ts`,
`providers.ts`, `prices.ts`, `history.ts` and `mappers.ts`. CS2Cap field names
exist only inside that folder. Above it, code speaks `Skin`, `SkinVariant`,
`MarketQuote`, `MarketProvider` and `PriceHistory` from `src/lib/types/`.

Two rules from that layer matter everywhere: money is carried as **integer minor
units** with its currency attached (`14250` + `BRL` is R$ 142,50, converted only at
render time), and a quote is a **lowest ask** — never an average, a last sale or a
valuation.

## Server boundary

Anything that touches a credential or needs work done before the browser sees it goes
through the **SvelteKit server**. Use the server whenever any of these is true:

- the API needs a key, token, secret or authentication header;
- the API does not support browser CORS;
- the response has to be normalised before the UI can use it;
- several providers have to be aggregated or compared;
- the logic itself should not be readable in a browser bundle.

Secrets never reach client code. Server-only integrations read configuration through
`$env/static/private` (values known at build time) or `$env/dynamic/private` (values
resolved at runtime). A provider secret must never be exposed through a `PUBLIC_*`
variable.

Everything under `src/lib/server/**` is server-only: SvelteKit refuses to bundle it
into client code, and that guarantee is the point. **Never import `$lib/server/**`
from a `.svelte` component or any other browser-reachable module.**

## Provider layer

The intended flow, once integrations exist:

```text
UI
↓
SvelteKit route / load / server endpoint
↓
Application service
↓
Provider adapter
↓
External API
```

Each marketplace is an independent **provider** (`docs/CONCEPT.md` § 22): Steam,
CSFloat, Skinport, DMarket and whatever comes next all return completely different
shapes. A provider module owns everything specific to one upstream:

- endpoint URLs;
- authentication;
- request format;
- response format;
- mapping to our contracts;
- provider-specific errors;
- provider-specific rate limiting and backoff.

Each provider eventually lives in its own folder:

```text
src/lib/server/providers/
├── steam/
├── csfloat/
├── skinport/
└── ...
```

**Create a provider folder when you implement that integration, not before.** There
are no provider folders today, and no base class, interface or factory waiting for
them. The shared shape will be obvious after the second real provider exists; it is
guesswork before that.

## Normalization

Provider responses are translated into **our** contracts before anything outside the
server layer sees them. Each provider owns its own mapping, next to the code that
fetches it — `src/lib/server/providers/cs2cap/mappers.ts`:

```text
CS2Cap response
↓
cs2cap/mappers.ts
↓
Skin · SkinVariant · MarketQuote · MarketProvider · PriceHistory
```

Product code must never depend on a provider-specific response shape. A component
that knows what CS2Cap calls its price field is a component that breaks the day the
upstream changes.

The normalised contracts live in `src/lib/types/`, because both server and (later)
browser code consume them. There is no separate server-side type folder: a type
nobody outside the server needs is either inferred from its Zod schema or declared
beside the module that returns it.

## Application services

`src/lib/server/services/` is **the boundary product code talks to**. Routes,
loaders and endpoints call a service; they do not reach into
`$lib/server/providers/cs2cap/**` themselves.

```text
Future UI / SvelteKit routes
        ↓
Application services   src/lib/server/services/
        ↓
Server cache           src/lib/server/cache/
        ↓
CS2Cap integration     src/lib/server/providers/cs2cap/
        ↓
CS2Cap API
```

The split is worth stating plainly: **providers are infrastructure, services are the
application.** Which upstream we use, how it is authenticated, what its payloads look
like and how long we cache them are all decisions that stop at the service layer. A
future route asking for a skin's prices should not know CS2Cap exists.

| Service              | Operations                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `catalog.ts`         | `browseSkins`, `getSkinBySlug`, `getSkinDetail`, `searchSkinSuggestions`, `getCatalogMetadata` |
| `market.ts`          | `getSkinPrices`, `getSkinPriceHistory`, `getMarketProviders`                                   |
| `kits.ts`            | `getEditorialKits`, `getResolvedKits`, `getResolvedKitBySlug`                                  |
| `discovery.ts`       | `enrichSkins`, `filterByVisual`, `visualMatchScore`, `rankByVisualMatch`                       |
| `visual-metadata.ts` | `visualMetadataKey`, `getVisualProfile`, `getVisualTaxonomy`                                   |

Services own the defaults that make data comparable — BRL, stale excluded, cheapest
first — so no caller has to remember them, and `getSkinPrices` computes `bestQuote`
because otherwise every caller would recompute the same thing slightly differently.

Two catalog lookups look similar and are not:

- **`getSkinBySlug`** reads the cached, fully-grouped index, so it returns a skin
  with its complete variant set. Explore, search, the skin page and kit resolution
  all go through it, which is what makes a slug mean the same thing everywhere.
- **`getSkinDetail`** resolves a skin by weapon and finish through the complete
  lookup path, for callers that have a name rather than a slug.

**`kits.ts` composes rather than fetches.** It reads our own static dataset and
joins it to the catalog index through `getSkinBySlug` — no upstream call of its
own, and deliberately **no market import**: a page of kits must cost zero price
requests. A kit's preferred exterior is treated as a promise, so an unmet one
raises `KitResolutionError` instead of silently resolving to a different item.
See `docs/KITS.md`.

**`getManySkinPrices` has two transports and one contract.** Which runs is
configuration (`CS2CAP_BATCH_PRICES_ENABLED`), never a probe:

```text
Kit Details  /kits/[slug]
        ↓
resolved editorial kit          kits.ts  →  catalog index
        ↓
one exact variant per item      variant.itemId
        ↓
multi-item market service       market.ts
        ↓
batch  ──  POST /prices/batch, cached whole
   or  ──  bounded individual requests (4 at a time), per-item cache
        ↓
pure purchase-strategy algorithms   src/lib/features/kits/
        ↓
SSR presentation
```

The failure models differ, and the difference is exposed rather than smoothed
over: individual mode reports per item, so one failed request leaves the rest
priced; batch mode succeeds or fails as one operation and marks every item
failed. Neither throws — a price outage is not a reason to fail a route.

Everything below the service is **pure**: `src/lib/features/kits/` takes
quotes in and gives plans out, with no Svelte, no I/O and no upstream types.
That is why switching purchase strategy in the UI performs no request: both
plans were computed on the server from the same quotes.

Exceptions to the service boundary: provider-specific tests, development
diagnostics, and integration debugging.

## Server cache

`src/lib/server/cache/` is a small TTL cache sitting between the services and the
provider layer. It exists because the CS2Cap plan has a finite monthly quota and the
cheapest upstream request is the one we never make.

It is **best-effort and process-local**: one `Map` in one Node process, gone when the
process ends. Across several instances or serverless workers each gets its own copy
and they will not agree — acceptable, because nothing in it is a source of truth.
Distributed caching is not a problem we have; solving it now would be inventing one.
Nothing is persisted to disk, a database or anywhere else.

What it guarantees:

- **TTL expiry**, from one policy file (`cache/config.ts`) rather than numbers
  sprinkled through the services.
- **Bounded memory.** Search keys are unbounded by nature, so the cache has a hard
  entry cap; expired entries are swept first, then the least recently used is
  evicted.
- **Deterministic keys** (`cache/keys.ts`). Equivalent requests collapse to the same
  string regardless of property order or casing. Keys are built purely from request
  arguments — no environment value or credential ever reaches one.
- **In-flight deduplication.** Ten concurrent requests for the same uncached key
  produce one upstream call and ten identical results.
- **Errors are never cached.** A 401, 429, timeout or malformed payload propagates to
  every waiting caller and leaves no entry behind, so the next request is free to
  retry. Caching a failure turns a blip into an outage.

### TTL policy

| Data                  | TTL     | Why                                                                              |
| --------------------- | ------- | -------------------------------------------------------------------------------- |
| Catalog item / detail | 1 hour  | Changes when Valve ships an update, not during a session                         |
| Catalog search        | 15 min  | The match _set_ shifts as the catalog grows; long-tail queries should not linger |
| Catalog metadata      | 6 hours | Effectively static between game updates                                          |
| Providers             | 10 min  | Slow-moving, but carries health status                                           |
| Prices                | 5 min   | The number the product is judged on; upstream refreshes every 5–10 min           |
| Price history         | 30 min  | Daily buckets only close once a day                                              |

These are _application_ lifetimes — how long we will serve what we already have.
They are not claims about upstream refresh schedules.

**Cache age and CS2Cap's `stale` flag are different things and must not be
conflated.** `stale` means the provider's own latest scan did not see that listing;
it is upstream's statement about the market. Our TTL is our own statement about our
memory. A cached quote is perfectly valid while its TTL holds, and the `stale` flag
on it is never recomputed from our cache age.

## API layer (client side)

`src/lib/api/` is the **browser-side** data access layer: typed calls to our own
internal endpoints, TanStack Query options, and the query client configuration. It
does not hold provider credentials and does not talk to marketplaces directly.

Rules that hold on both sides of the boundary:

- Every external payload is `unknown` until a Zod schema validates it. Types are
  inferred from the schema, never hand-written twice.
- Components never see a raw API payload shape; they see a domain type.
- Network logic stays out of presentation components.

## Discovery layer

CS2Cap is objective: weapon, wear, rarity, collection, price. It has no opinion
about what a skin _looks like_ — and "a red AK", "a clean black loadout" is how
`docs/CONCEPT.md` says people shop. That judgement is ours, curated by hand, and it
joins the catalog here:

```text
CS2Cap catalog
      ↓
normalized Skin
      +
local visual metadata   src/lib/data/
      ↓
Discovery layer         src/lib/server/services/discovery.ts
      ↓
Explore · Kits · Smart Loadout
```

Static curation **complements** CS2Cap, never replaces it. The split by filter type:

| Filter                                               | Resolved by                             |
| ---------------------------------------------------- | --------------------------------------- |
| weapon, wear, rarity, collection, StatTrak, Souvenir | CS2Cap query params                     |
| colour, style                                        | local visual metadata, after enrichment |

Never send a `color` or `style` parameter to CS2Cap — it has no such concept.

`discovery.ts` takes `Skin[]` from a caller and enriches, filters and ranks it. It
owns no catalog logic and **fetches nothing** — no prices, no providers, no network —
so visual filtering stays cheap enough to run over a whole page. A skin with no
curation gets `visual: null` and stays in the results; the catalog must not shrink
because of our own curation backlog.

The vocabulary is controlled and defined once in `$lib/types/visual-metadata.ts`;
`src/lib/data/` holds the records and their display labels, both Zod-validated.
Full rules in [`docs/VISUAL_METADATA.md`](VISUAL_METADATA.md).

## URL-driven pages

A page whose state is a filter set keeps that state in the **URL**, not in a store.
`/explore` is the worked example: every filter, the sort and the page number are
query parameters, validated server-side and answered by `+page.server.ts`.

That buys four things at once — a filtered view is shareable, survives a reload,
works with the back button, and renders on the server for a crawler. None of those
survive filter state living in client memory.

The shape:

```text
URL  ──parse──>  validated query  ──>  +page.server.ts  ──>  application service
 ^                                                                    |
 └──────────── every control builds a link ──── one URL utility <──────┘
```

Two rules keep it honest. One utility builds every Explore link, so "changing a
filter resets to page one" exists once instead of in the sidebar, the chips, the
sort control, the sheet and the pager. And TanStack Query stays out of it: this is
server-driven navigation, not client cache synchronisation.

**Catalog grids do not load prices.** One price request per card is an N+1 against a
metered API; batching belongs to the plan tier that supports it. A card rendered
without a price is not the same as a card whose price could not be found, and the
components keep those apart.

## Two searches, two models

The product has two search experiences, and they are built differently on purpose.

**Explore search** is faceted discovery: filters in the URL, answered by SSR, meant
to be shared and linked. **Global search** is "I know roughly what I want, get me
there": interactive, keystroke-driven, and nothing about it belongs in a URL.

```text
Explore          URL ──> +page.server.ts ──> catalog service ──> cached index
Global search    keystroke ──> TanStack Query ──> /api/search/skins ──> catalog service ──> cached index
```

So TanStack Query finally earns its place: a search box wants per-query caching,
request deduplication and cancellation of superseded requests, which is exactly what
it provides and exactly what a shareable filter URL does not need. Explore stays
SSR; converting it would trade indexability for nothing.

The browser never reaches CS2Cap. `/api/search/skins` is the application-facing
seam: it validates the query, reads the same cached catalog index Explore browses —
so typing costs no upstream request — and returns only the handful of fields a
result row renders.

Both searches rank with the **same function**. A skin cannot appear in a different
order depending on which search found it, and there is one algorithm to reason
about rather than two that drift.

## Partial failure

A page usually needs several things, and they do not fail together. Skin details is
the worked example:

```text
/skins/[slug]
      ↓
catalog service ──> identity      (failure here is route-level: 404 or 503)
market service  ──> prices        ─┐
                ──> providers      ├─ each degrades on its own
                ──> history       ─┘
```

Catalog identity is the page's reason to exist, so losing it is a route error. Losing
prices is not: the skin, its variants and its metadata are still worth showing, and a
visitor who followed a link deserves to see what they came for. Losing the provider
directory costs branding, not prices — rows fall back to the provider key rather than
dropping a real quote. Losing history costs the chart alone.

Concretely: those three are fetched with `Promise.all` and individually caught, so one
rejection never becomes a 500 for the whole route.

### The loadout builder

`/build` is the one interactive page in the product, and it splits cleanly into
a free half and a metered half:

```text
Builder UI
     ↓
GET /api/build/skins        one slot, one bounded page
     ↓
cached catalog index        no upstream request

Builder selections          slot + slug + variant, session-only
     ↓
"Check current prices"      explicit, never automatic
     ↓
POST /api/build/prices
     ↓
server resolution           slot, skin, compatibility, exact variant
     ↓
getManySkinPrices           batch or bounded individual
     ↓
lowest current total  ·  Steam comparison
```

**The catalog never ships wholesale to the browser.** Nearly two thousand skins
with every variant attached is megabytes nobody reads; the picker asks for
twenty options at a time, scoped to one slot. The knife slot holds 428 skins and
the browser sees 20.

**Pricing is user-triggered.** A loadout can hold 37 items, so a request per
edit would spend a metered quota on something nobody had finished building. Any
edit invalidates the displayed total by fingerprint comparison rather than by
clearing state from each edit path, so a new path cannot forget.

**The server validates every selection** before spending a request: unknown
slot, unknown skin, skin the slot does not accept, variant that does not exist,
duplicate slot — each is a whole-request `400`, never a silently dropped entry.

No large-loadout purchase optimization: the editorial-kit algorithm is exact
over item subsets and sized for eight. See `docs/BUILDER.md`.

### Keeping and sharing a loadout

Neither path stores anything on a server, and neither carries a price.

```text
Builder selections
     ↓
localStorage  "cs2-skins:builder:v1"    versioned, canonical identity only
     ↓
client restore
     ↓
POST /api/build/resolve                 catalog validation, zero market calls
     ↓
Builder
```

```text
Share action
     ↓
versioned encoded URL                   /build?loadout=v1.<base64url>

Shared URL
     ↓
SSR decode                              +page.server.ts, total — never throws
     ↓
catalog resolution                      the server decides what is real
     ↓
Builder
```

**One resolver, two temperaments.** `resolveOne` decides what is valid; pricing
rejects a whole request over one bad selection, restoring rejects that one and
keeps the rest with a reason code. They cannot disagree about validity because
there is only one implementation of it.

**Nothing is written before restoration resolves.** The builder starts empty and
a save arrives a moment later; a write in that window would destroy it. The gate
is one derived value, not a rule each caller remembers.

**A shared link is displayed, not adopted.** Viewing does not read, write or
touch the visitor's own save; editing does, and drops the now-stale `?loadout=`
from the address bar.

### Kit Details

A kit page has four ways to go wrong and treats each differently:

| Fails              | Result                                                             |
| ------------------ | ------------------------------------------------------------------ |
| Catalog resolution | **503** — a kit is nothing without the skins it names              |
| Unknown slug       | **404** — never a fallback to the first kit                        |
| Prices             | kit renders; per-item states; no total, no purchase plan           |
| Provider directory | kit renders and prices fully; groups fall back to the provider key |

The strict rule is that a **total needs every item**. A figure assembled from
four of five items is indistinguishable from a complete one, so the page shows
`Total unavailable` and says how many items are missing instead. Items that do
have prices still show them — the integrity rule is about the aggregate, not
about hiding what is known.

## Static data

Local JSON is the right tool for data that genuinely does not change at runtime:

```text
colours
rarities
weapon categories
visual/style tags
static mappings
editorial kit definitions
configuration-like metadata
```

`editorial-kits.json` is the worked example: it says which skins go together and
at which exterior, and nothing about what they cost. Prices, providers and
history stay dynamic, so a kit joins to live market data at request time rather
than carrying a stale copy of it.

That data lives in `src/lib/data/` and is loaded through a service, never imported
directly by product code. Note that CS2's own taxonomy (weapon types, wears,
rarities, collections) is _not_ static data for us: it comes from CS2Cap's catalog
metadata endpoint, so filters follow the catalog instead of drifting from it. What
_is_ ours is the visual vocabulary — colours and styles — because no upstream has an
opinion about it.

JSON is also acceptable as an explicit, clearly-marked development fallback when a
task calls for one. It is never the default source of market data.

## Visual curation and the candidate pool

The catalog says what a skin **is**. Only a person can say what it **looks
like**, and that judgement is the input to every recommendation the product
will make:

```text
catalog (1,974 skins, cached index)
        +
verified visual metadata (curated by hand, ~8%)
        ↓
curated candidate pool        getCuratedCandidates
        ↓
Smart Loadout                 generateSmartLoadout
```

The same two layers answer a second question on a skin page — not "what fits
this budget?" but "what looks like this?":

```text
Skin Details
        +
verified visual metadata
        +
curated catalog
        ↓
visual similarity             visualSimilarity
        ↓
Similar skins · Matches this skin
```

**No market service appears in that flow.** The page has already priced the skin
someone opened; pricing its recommendation cards would be eight more metered
requests for cards that show no price, and a test asserts
`services/recommendations.ts` does not import `./market` at all. Detail in
[`docs/RECOMMENDATIONS.md`](RECOMMENDATIONS.md).

The Knife + Gloves matcher is the same layers with prices on the end, and the
order of the steps is the whole design:

```text
Knife/Gloves source
        ↓
visual metadata
        ↓
opposite curated category
        ↓
similarity ranking
        ↓
bounded matches                   6, cut before pricing
        ↓
exact practical variants          one per skin
        ↓
multi-item current pricing        ONE request, ≤ 7 item ids
        ↓
pair cards
        ↓
Builder share codec               the existing v1 format
```

Ranking finishes before pricing starts and is never revisited, so price cannot
reorder a visual result. Detail in [`docs/KNIFE_GLOVES.md`](KNIFE_GLOVES.md).

The wishlist inverts the usual direction: the browser is the authority and the
server fills in what it cannot know.

```text
Skin Details
        ↓  exact variant + the price observed right now
local Wishlist v1              cs2-skins:wishlist:v1
        ↓
/wishlist hydration            identities only; the snapshot stays local
        ↓
POST /api/wishlist/resolve
        ↓
catalog exact-variant resolution      tolerant: one stale entry, not all of them
        +
multi-item current pricing            ONE request, no history
```

The homepage is the cheapest page in the product, and deliberately so:

```text
Home
├─ static product copy          no data at all
├─ existing catalog search      user-triggered, our own endpoint
└─ editorial kit service        three kits, no prices anywhere
```

**No market service appears in that list.** A cold visit to the front door
spends nothing at the price API, and a test asserts `+page.server.ts` imports
no market module. A failure in the kit preview costs the preview, not the page.

This is the **only** place the product persists a price, and it is a historical
snapshot rather than a cached current one — "R$ 153,00 when I saved this" stays
true, where a stored total would be a stale number pretending to be live. Detail
in [`docs/WISHLIST.md`](WISHLIST.md).

**Coverage is partial on purpose.** Curation is limited by how many skins
someone can actually look at, so the candidate pool is a fraction of the
catalog and the product model is built around that rather than around a
promise to classify everything. Coverage is measured honestly against the whole
catalog (`visualMetadataCoverage`), and the number that gates the feature is
candidates per core slot (`smartCoreCoverage`), not the headline percentage. It
is also what decides which colours `/smart-loadout` offers: a direction is
listed only when every required Smart Core entry has a curated candidate for
it.

The curation workspace is **development-only**: `/dev/visual-metadata` and its
endpoints 404 outside development, so a deployment has no write surface into
the dataset at all. Nothing in this path makes a market request — it is catalog
and judgement, and neither costs a price lookup.

## Client vs server fetching

The browser may call a third-party API directly **only when every one of these
holds**:

- the API is intentionally public;
- no key or secret is involved;
- it supports browser CORS;
- no server-side normalisation is needed;
- no aggregation across providers is needed;
- doing it directly buys a real architectural benefit.

Otherwise it goes through the SvelteKit server. **When in doubt, use the server** —
moving a call server-side later is cheap; discovering a leaked key in a client bundle
is not.

## Server endpoints

| Use                 | For                                                                       |
| ------------------- | ------------------------------------------------------------------------- |
| `+page.server.ts`   | Data tied to rendering one route                                          |
| `+layout.server.ts` | Data shared by a layout subtree                                           |
| `+server.ts`        | An internal application endpoint worth exposing (client refetch, polling) |
| `src/lib/server/**` | Reusable provider, service, mapper and server-only logic                  |

Do not create a server route without a concrete feature that needs it.

## Persistence

**There is no application database.** No ORM, no database client, no migrations, no
schema. Nothing is persisted server-side today.

Anything that needs to survive a reload currently lives in the URL or in the
browser. Introducing a database, or any library that implies one, requires explicit
approval first.

## Authentication

**Authentication is out of scope.** There is no login, registration, OAuth, session,
user account or remote user profile, and no auth library is installed. Features that
appear to need a signed-in user must be designed to work without one, or wait.

## Community features

Community Kits remain part of the product vision (`docs/CONCEPT.md` § 21) and are not
being removed from it. What is postponed is everything that needs persistence and
identity: creating and publishing kits that outlive a session, kit ownership, likes,
comments, follows, community profiles and moderation.

Static or editorial kits — curated by us, shipped as static data — can exist without
any of that, and are the sensible first step.

## Schema validation

`src/lib/schemas/` holds Zod schemas. A schema is the single source of truth for a
shape: validation, parsing, inferred TypeScript type, and form validation all come
from the same definition.

Domain types that are not derived from a schema live in `src/lib/types/`.

## Forms

- **Zod** defines the rules.
- **SvelteKit server actions** handle normal application forms.
- **Superforms** is the orchestration layer between the two (progressive
  enhancement, errors, state).

Validation logic is never re-implemented per component, and never duplicated between
client and server — the same schema runs in both places.

## Feature structure

```text
src/lib/features/<feature>/
```

A feature folder holds the logic of one product area (`skins`, `prices`, `search`,
`loadouts`, `kits`, `wishlist`): its queries, its transformations, its rune state,
its feature-specific types. Presentation lives in `src/lib/components/<domain>/`;
see `docs/COMPONENTS.md`.

Keep the dependency direction one-way: `routes` → `features` → `api`/`schemas`, and
on the server `routes` → `server/services` → `server/providers`. Features do not
import from each other's internals; if two need the same thing, it moves down a
layer.

## Server structure

```text
src/lib/server/
├── services/    the application boundary — what routes call
│                catalog · market · discovery · visual-metadata
├── cache/       TTL cache, key builders, TTL policy
└── providers/   infrastructure — one folder per upstream
    └── cs2cap/  client, schemas, endpoint modules, mappers
```

Not every service talks to an upstream: `discovery` and `visual-metadata` read local
curated data and do no I/O at all.

No base classes, interfaces, repositories, factories or dependency-injection
scaffolding. There is one upstream; a generic provider abstraction built for it would
be a guess about the second one. Empty `mappers/` and `types/` folders were removed
once it was clear where that code actually belongs.

## Components

`src/lib/components/ui` is the generic primitive layer (shadcn-svelte, vendored —
the CLI regenerates it). Everything domain-specific lives in a sibling folder.
Full rules in `docs/COMPONENTS.md`.

### Application shell

The root layout composes the shell and owns the document landmarks:

```text
+layout.svelte
├── skip-to-content link
├── AppHeader        header · brand · DesktopNav · MobileNav
├── main             the single main landmark, and the page's vertical rhythm
│   └── children     a route, wrapped in PageContainer
└── AppFooter        contentinfo
```

The layout keeps the QueryClientProvider around all of it, so SSR and the
per-request query client are unchanged. Navigation comes from `$lib/config/site.ts`
— one array, rendered by both the desktop and mobile navs — and the current section
is derived from `$app/state`, not from a store.

Route components render page content only; the header, the `main` element and the
container gutters are not theirs to re-declare.

## Utilities

`$lib/utils` resolves to `src/lib/utils.ts`, the shared helper module required by the
shadcn-svelte alias (`cn` and type helpers). It is a single file on purpose: a
`utils/` folder sitting next to `utils.ts` is ambiguous, and the alias must keep
resolving to the file. If it ever outgrows one file, move it to `utils/index.ts` and
update `components.json` in the same change. Domain logic belongs to a feature, not
here.

## Testing

| Layer      | Tool                               | Scope                                                        |
| ---------- | ---------------------------------- | ------------------------------------------------------------ |
| Units      | Vitest (`node`)                    | Pure modules: formatting, price math, schema parsing, config |
| Components | Vitest (`jsdom`) + Testing Library | Behaviour a user can observe: roles, labels, interaction     |
| End-to-end | Playwright                         | Real flows through a built app                               |

Component tests are named `*.svelte.spec.ts`; everything else `*.spec.ts`. Test what
the user experiences (`getByRole`, accessible names), not internal state. Playwright
browsers are not installed automatically: run `pnpm exec playwright install` once.

No fake test suites, no snapshot walls, no tests that assert the framework works.
