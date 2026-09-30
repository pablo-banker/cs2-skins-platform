# CLAUDE.md

Permanent working instructions for this repository. Read this before touching code.

## What this project is

A CS2 skin **aggregator, price comparator and loadout builder** — not a marketplace.
The product definition lives in [`docs/CONCEPT.md`](docs/CONCEPT.md).

Current state: **the MVP works end to end, from the homepage in.** `/` is the finished front door — product copy, a hero search and an entry point
to every surface, at zero market cost. `/explore`, global search,
`/skins/[slug]` — including variant selection,
live marketplace price comparison and 30-day history — `/kits` + `/kits/[slug]`
with live kit totals and purchase plans, `/build` with a session-only loadout
builder priced on request, and `/smart-loadout`, which turns a budget and a
visual direction into a real priced loadout, `/knife-gloves`, and `/wishlist`
are built. No database and no authentication — loadouts and the wishlist are
kept in the visitor's own browser, and loadouts are shared as encoded links. Do
not invent an account system or a server-side store.

## Read the docs first

All project documentation lives in `/docs`; this file is the only documentation in
the project root. **Before implementing any significant product feature, read:**

```text
docs/CONCEPT.md          the product — read-only, never edit
docs/ARCHITECTURE.md     SSR, server boundary, providers, data, forms, structure
docs/DESIGN_SYSTEM.md    tokens, palette, typography, motion
docs/FRONTEND_RULES.md   day-to-day coding rules
docs/COMPONENTS.md       where a component belongs
docs/ROUTES.md           provisional route map
docs/PROVIDERS.md        CS2Cap integration: endpoints, money, staleness, limits
docs/VISUAL_METADATA.md  curated colour/style data — taxonomy, keys, curation rules
docs/KITS.md             editorial kits — dataset, vocabulary, curation rules
docs/BUILDER.md          loadout builder — slots, selection identity, pricing flow
docs/SMART_LOADOUT.md    Smart Loadout — core, candidates, budget optimiser
docs/RECOMMENDATIONS.md  Similar skins and Matches this skin — scoring, slots
docs/KNIFE_GLOVES.md     Knife + Gloves matcher — pairing, pricing, pair totals
docs/WISHLIST.md         Wishlist — local storage, snapshots, price movement
docs/DEPLOYMENT.md       Production runtime, env contract, security, checklist
```

`docs/CONCEPT.md` is the product source of truth and must stay **byte-identical**:
never rewrite, reformat, move or rename it. It is excluded from Prettier
(`.prettierignore`) for exactly that reason.

## Stack (approved — nothing else)

SvelteKit · Svelte 5 · TypeScript (strict) · Vite · pnpm · Tailwind CSS 4 ·
shadcn-svelte · Bits UI · Lucide · GSAP · LayerChart · TanStack Svelte Query ·
Zod · SvelteKit Superforms · Vitest · Testing Library · Playwright · ESLint ·
Prettier · svelte-check.

## Rules

- **Use pnpm only.** Never npm, yarn or bun.
- **Do not install dependencies without explicit approval.** Especially not a second
  library for a responsibility the stack already covers: icons (Lucide), animation
  (GSAP + CSS), charts (LayerChart), forms (Superforms + Zod), server state
  (TanStack Query), UI primitives (shadcn-svelte / Bits UI).
- **Do not introduce a global state management library.** Use Svelte 5 runes
  (`$state`, `$derived`, `$effect`) and `.svelte.ts` modules.
- **Use Svelte 5 runes for all new reactive code.** No legacy `writable`/`readable`
  stores in new architecture without a concrete reason.
- **TypeScript strict stays on.** Never weaken `tsconfig.json` to fix a type error.
  Avoid `any`; use `unknown` at external boundaries and validate with Zod.
- **Use the existing design tokens.** Never hardcode a colour (`bg-[#080A0D]`) when a
  semantic token exists. The tokens in `src/app.css` are the source of truth.
- **Do not modify the design system without explicit approval** — that includes
  `src/app.css`, the palette, radii and typography.
- **Use Lucide (`@lucide/svelte`) exclusively for icons.**
- **Prefer shadcn-svelte / Bits UI primitives.** Never hand-roll a Dialog, Popover,
  Select, Dropdown, Tooltip, Tabs, Sheet or Combobox.
- **Do not use GSAP for trivial UI animation** (hover, fades, dropdowns, simple
  scale/opacity). Those are CSS, Tailwind or Svelte transitions. GSAP is for complex
  sequences and storytelling only, and must respect `prefers-reduced-motion`.
- **Preserve SSR by default.** Do not convert the app into an SPA, and do not reach
  for client-only rendering without approval.
- **Do not put domain-specific components in `src/lib/components/ui`** — that folder
  is for generic primitives only. See [`docs/COMPONENTS.md`](docs/COMPONENTS.md).
- **Do not put large reusable components directly inside route files.** Routes
  compose; they do not host the component library.
- **Do not duplicate API/domain types.** One definition, shared.
- **Do not implement product features unless explicitly asked.**
- **Prefer simple solutions over abstractions.** No premature layers, no wrappers
  around libraries that already have a good API, no barrel files that exist only to
  re-export one thing.

## Data and server architecture

Full reasoning in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). These rules are
permanent.

- **Dynamic market data comes from real external APIs**, not from static JSON by
  default. No `prices.json`, no fabricated market datasets.
- **JSON is only for genuinely static application data** — colours, rarities, weapon
  categories, style tags, static mappings, editorial content, configuration-like
  metadata — or for an explicitly requested dev/fallback scenario.
- **API keys and secrets never enter browser or client code.** Not in a component,
  not in a `PUBLIC_*` variable, not hardcoded anywhere.
- **Private integrations belong in SvelteKit server-only modules**, reading config
  from `$env/static/private` or `$env/dynamic/private`.
- **Never import `$lib/server/**` into browser-reachable code.**
- **Normalize third-party responses before they reach product components.** Provider
  payloads are translated server-side into our own contracts.
- **Product UI must never depend on a provider-specific response format.** If adding
  a marketplace would mean editing a component, the boundary is wrong.
- **Keep provider-specific logic isolated** — one folder per provider under
  `src/lib/server/providers/`, owning its URLs, auth, formats, errors and rate
  limits.
- **Prefer the SvelteKit server whenever there is uncertainty** about secrets, CORS,
  aggregation or normalisation. Direct browser calls to a third party are allowed
  only when the API is intentionally public, key-free, CORS-friendly, needs no
  normalisation and needs no aggregation.
- **Do not add a provider integration without explicit approval.** Do not call
  Steam, CSFloat, Skinport, DMarket or any other external API until then.
- **Do not introduce a database without explicit approval.** There is none today.
- **Do not introduce an ORM or database client without explicit approval.**
- **Do not introduce authentication without explicit approval** — no login,
  registration, OAuth, sessions or user accounts.
- **Do not implement persistent Community Kit publishing without explicit
  approval.** The concept stays in `docs/CONCEPT.md`; ownership, likes, comments,
  follows, profiles and moderation all wait for real persistence.
- **Avoid abstractions before a concrete feature requires them.** No base provider
  classes, generic repositories, factories, DI containers or empty interfaces. The
  `src/lib/server/` folders are intentionally empty until a real integration fills
  them.

## CS2Cap integration

The data layer is built. Detail in [`docs/PROVIDERS.md`](docs/PROVIDERS.md).

- **CS2Cap is the only dynamic market-data source for the MVP.** Catalog, images,
  variants, providers, live prices and history all come from it.
- **Do not add a direct marketplace integration without explicit approval.** Steam,
  CSFloat, Skinport, DMarket and the rest are reached through CS2Cap, never called
  directly.
- **CS2Cap access is server-only.** All of it lives in
  `src/lib/server/providers/cs2cap/`, and `$lib/server/**` is never imported by
  browser code.
- **Never expose `CS2CAP_API_KEY`** — not in client code, not in a `PUBLIC_*`
  variable, not in a log line, a test fixture or an error message.
- **Never use a raw CS2Cap response object in product code.** Field names like
  `lowest_ask`, `market_hash_name`, `is_stattrak` and `rarity_color` stay inside the
  integration folder.
- **Map CS2Cap responses into the normalized types** in `src/lib/types/` (`Skin`,
  `SkinVariant`, `MarketQuote`, `MarketProvider`, `PriceHistory`). Validate every
  response with Zod first — a 200 that fails the schema is an error, not data.
- **Money is integer minor units plus a currency.** `14250` + `BRL` is R$ 142,50.
  Never divide, round or store money as a float; convert once, at render time.
- **Use BRL for product-facing price requests.** CS2Cap does the conversion; we
  never implement FX.
- **A quote is a lowest ask** — not an average, a last sale, a fair price or a
  market value. Do not label it as one.
- **Exclude stale prices from comparison UI** (`exclude_stale=true` is the default).
  The `stale` flag stays on the quote for views that deliberately show older data.
- **Do not implement listing-level float features** — float search, exact float
  filters, inspect links, paint seeds, sticker valuation — unless the scope changes.
  Wear remains the variant dimension.

## Services and cache

- **Product routes and components use `$lib/server/services/**`, never
  `$lib/server/providers/cs2cap/**` directly.** Provider modules are infrastructure;
  services are the application boundary. The only exceptions are provider tests,
  development diagnostics and integration debugging.
- **Services return normalized application data** and own the comparison defaults —
  BRL, stale excluded, cheapest first.
- **Route CS2Cap-backed service operations through the existing server cache**
  (`$lib/server/cache/`), using the TTLs in `cache/config.ts`. Do not add a TTL
  number inline.
- **Never cache a failed request.** A 401, 429, timeout or malformed payload must
  leave no entry, so the next call can retry upstream.
- **Never create an unbounded cache structure.** Anything keyed on user input needs a
  cap and an eviction path.
- **Do not introduce Redis, a database or a distributed cache without approval.** The
  cache is deliberately process-local and best-effort.
- **Do not conflate application cache age with CS2Cap's `stale` flag.** They answer
  different questions; never recompute one from the other.

## Visual metadata

Colour and style curation. Detail in [`docs/VISUAL_METADATA.md`](docs/VISUAL_METADATA.md).

- **CS2Cap is the objective source** (weapon, wear, rarity, collection, prices);
  **local visual metadata is the subjective one** (colours, styles). Never ask
  CS2Cap for a `color` or `style` parameter — it has no such concept.
- **Never put dynamic market data in the static JSON.** No price, provider,
  quantity, currency, timestamp or history; the schema rejects unknown fields and a
  test enforces it.
- **Visual metadata is product-level**, shared by every wear, StatTrak and Souvenir
  variant. One record per skin, never one per `item_id`.
- **Always build the key with `visualMetadataKey()`.** Never hand-write one, and
  never derive identity from an item id, a wear, a StatTrak flag or a route slug.
- **Never infer production colours or styles from a skin's name.** `Redline` is not
  automatically red, `Containment Breach` is green, and a phased Doppler has no
  single colour at all. Every production record is written after looking at the
  image; a missing record beats a guessed one.
- **Curation tooling is development-only.** `/dev/visual-metadata` and its
  endpoints 404 outside development, and no production write path exists.
- **Visual curation and candidate selection make zero market calls.** They are
  catalog-and-judgement work; prices belong to a different question.
- **Coverage is partial and must never be presented as complete.** Roughly 8% of
  the catalog is classified. Smart Loadout generates from the **curated
  candidate pool**, which is a deliberate product model, not a gap to paper over.
- **An unclassified skin stays usable** — `visual: null`, still searchable, still
  priceable. Never drop a catalog item for lack of curation.
- **Do not expand the colour or style taxonomy casually.** Every new value makes
  every existing record potentially under-classified.
- **Discovery never fetches.** Enrichment, filtering and scoring do no I/O.

## Application shell

- **Wrap page content in `PageContainer`.** It owns the gutters and the max width;
  a route that sets its own breaks alignment with the header.
- **Global navigation comes from `$lib/config/site.ts`.** Never hardcode a nav label
  or href in a component, and never keep separate desktop and mobile definitions.
- **Shell components live in `components/layout/`**, never in `components/ui/`.
- **The root layout owns the single `<main>` landmark** and the page's top spacing.
  Routes do not add their own padding to clear the header.
- **The product name is `site.name`** — a temporary working label, never hardcoded
  and never designed around.
- **No dead controls.** Do not add a search box, an account menu or any button
  without behaviour; ship the control with the feature that makes it work.

## Domain components

- **Presentational only.** A component in `components/skin/` or `components/market/`
  never calls a service, a query or `fetch`. Data arrives as props.
- **Normalized types only.** Components consume `Skin`, `SkinVariant`,
  `MarketQuote`, `MarketProvider`, `PriceHistory` — never a raw upstream field.
- **Money is integer minor units plus a currency**, formatted only by
  `$lib/formatters/currency`. Never divide by 100 in a component, and never let
  zero, negative or fractional amounts render as a price.
- **BRL is the MVP display currency** and money is formatted `pt-BR`; product copy
  is **English** for now. Those are separate decisions — do not mix languages in the
  interface.
- **Rarity presentation comes from `$lib/config/rarity`**, never from the upstream
  hex on the skin.
- **A lowest ask is a lowest ask.** Never label it an average, a last sale, a fair
  value or a market value.

## Catalog pages

- **Faceted filters live in the URL**, parsed by `$lib/schemas/explore.ts` and built
  by `$lib/features/skins/explore-url.ts`. No store, no context, no `localStorage`,
  and never two places that build the same link.
- **Never issue one price request per catalog card.** Grids are catalog-only;
  `Promise.all` around an N+1 is still an N+1.
- **A grid without prices is allowed**, and it must not say "price unavailable" —
  not requested and not found are different states.
- **Offer only sorts you can perform over the whole result set.** Sorting one loaded
  page under a label that implies catalog ordering is a lie.
- **Detail pages resolve the complete skin** (`getSkinBySlug` / `getSkinDetail`),
  never a page-scoped search result, whose variant set may be partial.
- **Slugs are assigned by the catalog index, not parsed.** Weapon + finish is not
  unique; resolve a slug by lookup and 404 an unknown one rather than inventing a
  skin.

## Search

- **Two models, kept apart.** Explore is URL-driven SSR faceted filtering; global
  search is interactive client server-state through TanStack Query. Do not convert
  Explore to Query, and do not make global search navigate per keystroke.
- **The browser calls `/api/search/skins`, never CS2Cap.** Client-side data always
  goes through an internal application endpoint.
- **Global search never fetches prices.** It is a navigator; comparison lives on the
  skin page.
- **Reuse the canonical slug.** A search result and an Explore card must open the
  same URL — there is one slug source, the catalog index.
- **Reuse the ranking function.** Do not write a second matching or relevance
  algorithm, and do not add a fuzzy-search dependency.

## Skin details

- **The route identifies the grouped skin; the variant lives in query parameters**
  (`wear`, `edition`, `phase`), written in our vocabulary rather than upstream
  identifiers. Canonical is the product URL, without them.
- **Fetch prices and history for the selected variant only.** Never
  `Promise.all` over every variant — that is eleven metered requests for ten pages
  nobody opened.
- **Prices, providers and history fail independently** of catalog identity and of
  each other. A price outage still renders a usable skin page; a missing provider
  entry still renders its price.
- **No float UI.** Float ranges exist in the catalog and stay out of the product.
- **No polling and no refresh button.** Upstream moves every few minutes and the
  price cache is five.

## Editorial kits

Curated skin sets. Detail in [`docs/KITS.md`](docs/KITS.md).

- **Kits are content, not a cache.** `src/lib/data/editorial-kits.json` holds which
  skins go together and at which exterior. Never a price, total, provider or
  timestamp — a number committed there is wrong before the commit lands.
- **`/kits` costs zero price requests.** `kits.ts` imports no market service, and
  a test enforces it. Totals and purchase strategy belong to `/kits/[slug]`.
- **A stated variant is a promise.** `resolveKit` raises `KitResolutionError` when a
  named exterior or phase does not exist, rather than substituting one — otherwise
  the product shows, and later prices, a different item than was curated.
- **Skins are referenced by route slug**, never by upstream `item_id`, so a kit, an
  Explore card and a search result all open the same URL.
- **Tags come from the shared visual vocabulary** (`SKIN_COLORS`, `SKIN_STYLES`).
  A kit's name may be editorial (`Crimson`); its tags may not.
- **Curate by looking at images, never at names.** `AWP | Atheris` sounds blue and
  is green. A name-derived kit is plausible, wrong, and invisible until opened.
- **Array order is editorial order** — file order is page order, and a kit's first
  four items are its cover. That is why `/kits` has no sort control.
- **An unknown kit slug is a 404**, never a fallback to the first kit.
- **Kit Details prices the exact editorial variant**, by `variant.itemId`. The
  variant priced, the variant shown and the variant linked are always the same one.
- **`/kits` loads no market data.** Only the kit a visitor opens is priced.
- **A full kit total requires every item to have a usable quote.** Never present a
  partial subtotal as a complete total; say it is unavailable and how much is
  missing.
- **Lowest price and fewer marketplaces are pure deterministic algorithms** in
  `$lib/features/kits/`. Fewer-marketplaces minimises provider count first and
  total second, exactly (not greedily), for kits of at most eight items.
- **Switching purchase strategy performs no network request.** Both plans come
  from the same server-computed quotes.
- **Batch pricing is server configuration** (`CS2CAP_BATCH_PRICES_ENABLED`), never
  probed. Both transports produce the same application data.
- **Do not model marketplace fees** without explicit, reliable checkout semantics.
  Totals compare current lowest asks and the copy says so.

## Loadout builder

Detail in [`docs/BUILDER.md`](docs/BUILDER.md).

- **Loadout slots are product-owned configuration**, in `$lib/config/loadout`,
  not raw provider discovery. A new upstream base name must never grow a builder
  section on its own; someone reviews it and edits the registry.
- **A selection is `{ slotId, skinSlug, variant }`** — our identity, never an
  upstream item id. The id is derived server-side for pricing and discarded, so
  a future saved or shared loadout is not tied to someone else's numbering.
- **The server validates every selection** against the registry — slot exists,
  skin exists, slot accepts that skin, variant exists exactly, no duplicate slot
  — and rejects the whole request rather than dropping bad entries.
- **Builder pricing is user-triggered**, never automatic, and any edit
  invalidates the previous result by fingerprint.
- **The catalog never ships wholesale to the browser.** The picker asks for one
  bounded, slot-scoped page.
- **A loadout total needs every _selected_ item priced.** Empty slots do not
  make it incomplete.
- **Do not apply the editorial-kit fewest-marketplaces algorithm to a loadout.**
  It is exact over item subsets and sized for `N <= 8`; a loadout holds 37.
- **Builder persistence stores canonical application identity only**, under one
  versioned key (`cs2-skins:builder:v1`). Never an upstream item id, and never
  anything the market owns.
- **Pricing is never stored or shared.** A restored or shared loadout starts at
  "not calculated"; a stale total restored as current is worse than none.
- **Persistence and share formats are versioned**, and an unrecognised version
  is discarded rather than read as the current one.
- **Shared payloads are server-validated.** The codec returns what a link said;
  only catalog resolution decides whether it describes anything real.
- **Local restore is tolerant, pricing stays strict** — one `resolveOne`, two
  behaviours. A stale saved selection is rejected and reported, never
  substituted, and never a reason to discard the rest.
- **Never write builder state before restoration resolves**, and never let a
  shared loadout overwrite the visitor's own until they edit it.
- **There is no cloud persistence.** One loadout, one device, no accounts, no
  named or multiple saves.

## Smart Loadout

Budget + visual direction → a real priced loadout. Detail in
[`docs/SMART_LOADOUT.md`](docs/SMART_LOADOUT.md).

- **The client sends preferences and nothing else** — a budget, a colour, a
  style and two booleans. Never a slot id, a skin slug, a candidate count or an
  item id. The server owns the Smart Core, the curated dataset and the candidate
  logic; the request schema is `.strict()`, and an unknown field is a 400.
- **Rank visually first, then price once.** The shortlist is capped at
  `SMART_CANDIDATES_PER_ENTRY` per entry and the total at
  `SMART_MAX_PRICED_CANDIDATES`, enforced by a throw. One multi-item request per
  generation, through the existing price cache — never one per candidate, and
  never every exterior of a candidate.
- **Generate from curated skins only.** An uncurated skin has nothing to match a
  colour on. `getCuratedCandidates` is the one place uncurated items are dropped.
- **Colour is never relaxed.** Colour+style falls back to colour alone, never to
  a different colour, and the result says when it did (`partialStyleMatch`).
  A style asked for alone has nothing weaker to fall back to.
- **Offer only preferences that can work.** `getSmartAvailability` decides what
  the form lists, from the curated dataset, with no market request.
- **The budget is a ceiling, not a target.** Among equally good loadouts, pick
  the cheaper one. `budget-too-low` reports the real minimum from the shortlist
  that was priced.
- **Keep the four failure reasons apart** — curation gap, pricing gap, budget
  gap, outage. Each needs a different answer, and a failed generation is a 200
  with a reason, not an error.
- **The optimizer stays pure.** `features/smart-loadout/optimizer.ts` takes
  pools and a budget; no catalog, no config, no I/O. Its exactness is verified
  against exhaustive search, so do not replace it with a greedy pass.
- **Knife and gloves are opt-in, and unchecked means never priced.**
- **Hand off through the existing share codec.** "Open in Builder" is an
  ordinary `?loadout=` link, so a generated loadout arrives as a _shared_ one and
  does not overwrite the visitor's save.
- **No polling, no refresh button, no per-item offer button, no float UI**, and
  a generation is never a side effect of typing.

## Visual recommendations

Similar skins and Matches this skin, on `/skins/[slug]`. Detail in
[`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md).

- **Never infer metadata for an uncurated skin.** Recommendations run on the
  verified dataset only; there is no fallback, no name heuristic and no guess.
- **An uncurated source skin shows no recommendation sections** — not an empty
  box, and never a message apologising for our curation backlog. The rest of the
  skin page is unchanged.
- **Similar means the same Builder slot. Matches means a different one.** Slot
  identity comes from the Builder registry (`slotForSkin`), never from parsing a
  weapon name — that is also how knives and gloves work without a special case.
- **Cross-slot matches are filled one slot at a time**, every slot before any
  second, and nothing is invented to reach the limit.
- **Recommendation logic performs zero market calls.** No prices, no providers,
  no history — `services/recommendations.ts` does not import `./market`, and a
  test enforces it. Cards render with `showPrice={false}`.
- **Never show a raw similarity score.** It ranks a short list; it is not a
  percentage, not comparable between source skins, and not a customer metric.
- **`MIN_VISUAL_SIMILARITY_SCORE` is shared by every visual recommendation.**
  One exported constant, no local copies, and **never lowered to fill a grid** —
  fewer honest results beat filler, and an empty section is a curation signal.
- **Price, rarity and collection never influence visual similarity.**
- **Ranking is deterministic** — score descending, then canonical slug. The same
  metadata must produce the same page every load.
- **Recommendations are product-level**, identified by route slug, and link to
  the canonical `/skins/[slug]` with no variant in the query.
- **A recommendation failure must never break the skin page.** Price comparison,
  history and identity render regardless.
- **Reuse `SkinCard`.** Do not build a second recommendation card, and do not add
  a carousel dependency for six cards.

## Knife + Gloves matcher

`/knife-gloves`. Detail in [`docs/KNIFE_GLOVES.md`](docs/KNIFE_GLOVES.md).

- **Opposite category only.** A knife matches gloves, gloves match knives, and
  firearms never enter — `Matches this skin` already covers cross-equipment
  discovery. Category comes from the Builder slot registry, never a weapon name.
- **Reuse the shared score.** `visualSimilarity` and
  `MIN_VISUAL_SIMILARITY_SCORE`, unchanged. No knife-and-glove aesthetic model:
  a pair that matches on a skin page must match here.
- **Rank visually, then price, and never re-rank.** Cut to
  `KNIFE_GLOVE_MATCH_LIMIT` before the market request. One
  `getManySkinPrices` call, at most seven item ids, and no history.
- **The source honours an explicit variant exactly.** Only an unspecified one
  falls back to `pickPracticalVariant`, which is shared with Smart Loadout —
  normal edition, Field-Tested first, deterministic.
- **A pair total is both lowest asks in one currency, or nothing.** Never a
  half-total, and never a claim that one marketplace sells the pair.
- **Prices are context, not the feature.** A market failure costs the totals and
  nothing else; the pairing still renders.
- **Bad selection state is recoverable, never a route error.** An unknown slug, a
  firearm or an uncurated item answers 200 with the picker intact.
- **Hand the pair over with the existing share codec.** `/build?loadout=`, two
  selections, no new format and no special case around a saved loadout.
- **Only offer the Skin Details CTA for a curated knife or gloves**, and keep the
  matcher out of the main navigation for now.

## Wishlist

Local-only saved skins. Detail in [`docs/WISHLIST.md`](docs/WISHLIST.md).

- **Wishlist storage is versioned and its own** — `cs2-skins:wishlist:v1`, never
  the builder's key, and an unrecognised version is discarded rather than read.
- **Identity is the exact skin and the exact variant.** The same grouped skin
  may appear more than once when the variants differ; build the key with
  `wishlistItemKey()` and nowhere else.
- **The snapshot price is the one price the product persists**, and it is a
  historical baseline, not cached market data. It is immutable until the item is
  removed and re-added — never refreshed by opening the page, by re-saving, or
  during a current-price load.
- **A missing snapshot is fine.** Never refuse a save because the market is
  quiet.
- **`/wishlist` prices the whole list in one multi-item request**, automatically
  on open, with no polling, no refresh button and no history — never a per-card
  waterfall.
- **The endpoint takes identities only.** The snapshot and the timestamp stay in
  the browser; the server is not handed numbers a client wrote.
- **Resolution is tolerant and never substitutes.** A stale entry is reported
  and pruned after a successful response, not swapped for a nearby exterior.
- **Price movement is buyer-oriented.** Lower, higher, no change. No profit, no
  loss, no percentage, no total across the list.
- **No alerts and no cloud sync exist.** Nothing runs in the background, so do
  not add price alerts, target prices or notifications.

## Home

`/` is the product's front door. Detail in [`docs/ROUTES.md`](docs/ROUTES.md).

- **Home stays lightweight and price-free.** No price, provider or history
  request on load, and none while someone types in the hero search. The only
  server work is resolving a few editorial kits, which carry no price.
- **A secondary section failing never fails the page.** The kit preview is
  omitted if it cannot resolve; the hero, the workflows and the links remain.
- **Only claim what is built.** No capability the product does not have, and
  nothing implying we sell skins — we compare prices and link out.
- **No popularity or social proof.** No trending, most-viewed, most-searched,
  user counts, testimonials or star ratings; there are no analytics, so all of
  those would be invented. No account or paid-tier UI either.
- **Home links to workflows rather than reimplementing them.** The hero search
  shares `createSkinSearch` with the header; every section is an entry point to
  the surface that owns the work.
- **`+page.server.ts` exports only what SvelteKit allows** — `load` and its
  siblings. A shared constant belongs somewhere importable.

## Production

Detail in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

- **The production target is a long-lived Node process** through
  `@sveltejs/adapter-node`, and the architecture depends on it: the catalog
  index, the bounded caches and in-flight deduplication all live in process
  memory. Do not restructure for serverless, and do not add Redis or a
  distributed cache without real traffic to justify it.
- **`pnpm start` runs the production server.** `vite preview` is a development
  convenience and is never the runtime.
- **Nothing hardcodes a port, a host or a domain.** `PORT`, `HOST` and `ORIGIN`
  come from the environment; canonical tags and share links are built from
  `ORIGIN`.
- **Build a canonical URL with `new URL(resolve(…), origin)`, never string
  concatenation.** `resolve()` returns a path relative to the current URL, so
  `origin + resolve(…)` silently produces `https://host./route`.
- **One `<meta name="description">` per page, owned by the route.** The root
  layout sets none — a site-wide fallback is emitted first and wins, which
  silently discards every page's own description.
- **`/api/health` is liveness and touches nothing.** No catalog, no market, no
  key check. An upstream outage must never restart a healthy process.
- **The image is secret-independent.** No build arg, no baked `ENV`, no `.env`
  in the build context. Secrets arrive at runtime.
- **Development surfaces must 404 in production**, and that is verified against
  the real build rather than trusted from a `dev` check.
- **Keep `script-src 'self'` with no inline escape.** CSP lives in
  `vite.config.ts`; widen an origin only after confirming the application
  actually needs it.
- **Bounds are not rate limiting.** Every market-touching endpoint is
  schema-bounded, but per-IP limiting belongs at the edge — a limiter built on
  an untrusted forwarded header is worse than none.
- **No analytics, ever.** Operational server logs are not product analytics,
  and they never carry a key, a share payload or anything from a visitor's
  device.
- **Nothing may outlive a server render.** A timer, a listener or an abort
  signal still live when a render ends is a GC root, and it holds everything
  behind it. This already cost one out-of-memory crash: the root layout's
  `QueryClient` kept a `gcTime` timer per request. The layout clears it on
  destroy, server-side only — see `docs/DEPLOYMENT.md`.

## After meaningful changes

```bash
pnpm check      # svelte-check, TypeScript
pnpm lint       # prettier --check + eslint
pnpm test:unit  # vitest
pnpm test:e2e   # playwright, against a real production build
pnpm build      # production build
```

Fix problems properly. Do not silence errors to make a check pass.

## Reference docs

| File                                                 | Covers                                 |
| ---------------------------------------------------- | -------------------------------------- |
| [`docs/CONCEPT.md`](docs/CONCEPT.md)                 | The product (read-only)                |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)       | SSR, server boundary, providers, data  |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)     | Tokens, palette, typography, motion    |
| [`docs/FRONTEND_RULES.md`](docs/FRONTEND_RULES.md)   | Day-to-day coding rules                |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md)           | Where a component belongs              |
| [`docs/ROUTES.md`](docs/ROUTES.md)                   | Provisional route map                  |
| [`docs/PROVIDERS.md`](docs/PROVIDERS.md)             | CS2Cap integration contract            |
| [`docs/VISUAL_METADATA.md`](docs/VISUAL_METADATA.md) | Curated colour/style data              |
| [`docs/KITS.md`](docs/KITS.md)                       | Editorial kits and their curation      |
| [`docs/BUILDER.md`](docs/BUILDER.md)                 | Loadout builder: slots and pricing     |
| [`docs/SMART_LOADOUT.md`](docs/SMART_LOADOUT.md)     | Smart Loadout: candidates and budget   |
| [`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md) | Similar skins and cross-slot matches   |
| [`docs/KNIFE_GLOVES.md`](docs/KNIFE_GLOVES.md)       | Knife + Gloves pairing and pair totals |
| [`docs/WISHLIST.md`](docs/WISHLIST.md)               | Wishlist: storage, snapshots, movement |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)           | Running it in production               |
