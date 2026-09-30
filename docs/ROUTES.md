# Routes

Every route in the product, and the endpoints behind them. Product detail for
each area lives in `docs/CONCEPT.md`; this file records the URL architecture.

| Route            | Status    | Purpose                                                             | Concept    |
| ---------------- | --------- | ------------------------------------------------------------------- | ---------- |
| `/`              | built     | Home — what the product is, search, and the way into every surface  | § 18       |
| `/explore`       | built     | Discover: browse and filter by weapon, exterior, rarity, collection | § 4.2      |
| `/skins/[slug]`  | built     | A skin: variants, marketplace price comparison, history, related    | § 5, § 17  |
| `/kits`          | built     | Curated kit index, by colour and visual direction                   | § 7, § 8   |
| `/kits/[slug]`   | built     | A single kit: its skins, live totals and purchase plans             | § 7        |
| `/build`         | built     | Manual loadout builder, priced on request                           | § 9        |
| `/smart-loadout` | built     | Budget + preferences → a generated, priced loadout                  | § 11, § 12 |
| `/knife-gloves`  | built     | Pair a knife with gloves, or the reverse, with pair totals          | § 16       |
| `/wishlist`      | built     | Skins saved in this browser, and how their prices have moved        | § 15       |
| `/profile`       | not built | Saved loadouts, kits, favourites, preferences — needs accounts      | § 19       |

Operational routes, outside the product surface: `/api/health` (liveness),
`/robots.txt` and `/sitemap.xml`. `/dev/*` and `/api/dev/*` are development
tooling and return 404 in production.

Primary navigation comes from `mainNav` (`$lib/config/site.ts`); home is reached
through the brand link and the wishlist through the header's heart icon.
`+error.svelte` covers 404 and every other status with one calm, generic page.

## `/`

The front door. SSR-first: the copy, the headings and every product link are in
the server-rendered HTML, so a crawler and a slow connection get the same page.
Only the hero search hydrates.

| Section                  | Links to                                        |
| ------------------------ | ----------------------------------------------- |
| Hero + search            | a skin page directly, `/explore`, `/build`      |
| Where to start           | `/explore`, `/build`, `/smart-loadout`, `/kits` |
| Build around your budget | `/smart-loadout`                                |
| Curated kits preview     | three kits, and `/kits`                         |
| Match knives and gloves  | `/knife-gloves`                                 |
| Keep an eye on it        | `/explore`, `/wishlist`                         |

**A cold visit costs zero market requests** — no prices, no providers, no
history — and a test asserts the loader imports no market service. The only
server work is resolving three editorial kits, which carry no price by
construction. If that fails the preview is omitted and the rest of the page
renders; a secondary section is not a reason to 500 the front door.

The hero search reuses `createSkinSearch`, the same debounce, endpoint,
threshold and ranking as the header dialog — a different presentation, not a
second implementation. It fetches no prices while typing.

Canonical is `/`, with no query variation. There is deliberately **no
structured data**: we are not the merchant.

## `/explore`

SSR through `+page.server.ts` and the catalog **service** — filters have to work on
the first render, or a filtered URL is not really shareable.

**The URL is the filter state.** `q`, `weapon`, `weaponType`, `wear`, `rarity`,
`collection`, `stattrak`, `souvenir`, `sort`, `page`. Nothing lives in a store, in
`localStorage` or in component state, so every view is shareable, reloadable and
back-button friendly. `$lib/schemas/explore.ts` validates the query and
`$lib/features/skins/explore-url.ts` builds every link, which is what keeps
"changing a filter resets to page one" a single rule rather than five.

Sorting is `relevance` (default), `name-asc` and `name-desc` — computed over the
complete filtered set, never over one page. There is no price sort because Explore
loads no prices.

Colour and style filters are deliberately absent: the curated dataset is empty, and
a filter that always returns nothing is not a feature. Price range filters wait for
batch price enrichment (`docs/PROVIDERS.md`).

## `/skins/[slug]`

SSR. Resolves the slug against the catalog index and **404s an unknown slug** rather
than dressing an arbitrary URL up as a product.

**The route identifies the product; the query selects the variant.** Wear is not part
of the path, because `AK-47 | Redline` is one product whose exteriors are views of it:

| Parameter | Values                                                 |
| --------- | ------------------------------------------------------ |
| `wear`    | An exterior the skin actually has, e.g. `Field-Tested` |
| `edition` | `normal`, `stattrak`, `souvenir`                       |
| `phase`   | A phase label for phased finishes, e.g. `Phase 2`      |

They are written in our own vocabulary, never upstream identifiers — `?wear=Field-Tested&edition=stattrak`,
never `?item_id=12633`. Unrecognised values are dropped and the page falls back to the
nearest real variant instead of erroring. A default selection produces no query at
all, so the plain product URL stays clean.

The **canonical URL is the product**, without variant parameters: exteriors are views
of one skin, not separate pages to index.

Prices, the provider directory and history are fetched **only for the selected
variant**, and each failure degrades on its own — a price outage still leaves a
usable skin page.

Slugs are assigned by the index, not parsed: weapon + finish is **not unique**
(measured against the live catalog, `Desert Eagle | Sunset Storm 壱` and `弐` slugify
identically, and 42 such pairs exist catalog-wide). Colliding slugs get a numeric
suffix in a deterministic order, so `/skins/desert-eagle-sunset-storm` and
`/skins/desert-eagle-sunset-storm-2` are both stable and both reachable.

### Visual recommendations

Two sections below the market data: **Similar skins** (other finishes for the
same Builder slot) and **Matches this skin** (other slots that pair with it).
Both are server-rendered from the load, both cost **zero market requests**, and
both are omitted entirely when the skin has no curated visual profile — no empty
box and no apology for our curation backlog.

There is deliberately **no `/api/recommendations`**: the page is SSR, so the
sections are in the first response, which is what a crawler gets too. Cards link
to plain `/skins/[slug]` with no variant in the query. See
[`docs/RECOMMENDATIONS.md`](RECOMMENDATIONS.md).

## `/kits` and `/kits/[slug]`

SSR. Both resolve our own editorial dataset against the catalog index, which costs
no upstream call of its own.

**`/kits` makes no market request at all**, and a test enforces it. Pricing four
kits to render a listing would mean pricing every item of every kit before anyone
has chosen anything. Live pricing belongs to the kit a visitor opened.

`/kits` renders the dataset in file order and has **no filter or sort controls**.
With four kits, ordering is an editorial decision made in the JSON, not a control
for the visitor to operate. Adding filters here is a product decision that waits for
a catalog large enough to need them.

`/kits/[slug]` **404s an unknown slug** rather than falling back to the first kit.
The canonical URL is the kit; there are no variant parameters, and **no market
total ever reaches the title, description or OpenGraph tags** — those are current
prices and would be wrong by the time anything crawled or shared them.

It is the one kit page that loads market data: current prices for the exact
variants the kit names, in a single multi-item request, plus the cached provider
directory. No price history — that is the skin page's job — and no request per
item. A kit total is shown only when every item has a usable quote; otherwise the
page says `Total unavailable` and how many are missing, while the items that do
have prices still show them.

Two purchase plans are computed server-side from the same quotes — **Lowest
price** and **Fewer marketplaces** — so the control that switches between them
performs no request and needs no URL state. See `docs/KITS.md` for the rules and
the algorithms.

**Kit composition stays immutable.** Nothing here edits a kit, saves one, or
creates one; the dataset is the only way a kit changes.

Each included skin links to `/skins/[slug]` **at the exterior the kit intends**,
built with the same `skinVariantSearch` helper the skin page uses — so a kit's
Field-Tested AK lands on the Field-Tested AK. An item whose kit preference is
already the skin's default produces a plain product URL with no query.

A catalog outage is a **503 at route level** on both, because a kit is nothing
without the skins it names. A **market** outage is not: the kit still renders,
without totals. See `docs/KITS.md` for the dataset and curation rules.

## Internal endpoints

| Endpoint                           | Purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| `GET /api/search/skins?q=`         | Global search suggestions for the command dialog  |
| `GET /api/build/skins`             | Loadout picker options for one slot, bounded page |
| `POST /api/build/prices`           | Current prices for a loadout, on explicit request |
| `POST /api/build/resolve`          | Saved or shared selections back into catalog data |
| `POST /api/smart-loadout/generate` | Preferences → a generated, priced loadout         |
| `GET /api/dev/cs2cap`              | Development diagnostic, 404 in production         |

`/api/search/skins` is **application-facing, not provider-facing**: it exists
because the browser cannot call a server-only service, not because CS2Cap needs
proxying. It validates the query (2–100 characters), answers from the cached catalog
index, returns `{ query, items, hasMore }` with at most ten items, and reveals
nothing about the upstream — a failure is a plain "temporarily unavailable".

**Canonical is the bare `/explore`, whatever the filters say.** Weapon × exterior
× rarity × collection × sort × page multiplies one page into tens of thousands of
URLs that are all the same catalog through a different lens. The skins are the
indexable pages, and each carries its own canonical.

## `/build`

SSR shell, interactive body. The server load sends the **slot registry** and
nothing else — 37 slots in six categories — and the catalog stays where it is.

`GET /api/build/skins?slot=&q=&page=` returns one bounded page (20) of the skins
a slot accepts, with their real variants attached so an exact choice is
possible. It reads the cached catalog index, so browsing and searching cost
**zero upstream requests**, and an unknown slot is a `400` rather than an empty
page that would read as "this slot has nothing in it".

`POST /api/build/prices` takes selections in **our** identity — slot, skin slug,
variant — never catalog item ids, and re-validates every one against the slot
registry before spending a request. Invalid selections are rejected whole.

`POST /api/build/resolve` turns canonical selections back into current catalog
data for a saved or shared loadout. **Catalog only** — no price request, ever —
and tolerant where pricing is strict: a selection that no longer resolves is
returned as `rejected` with a safe reason code rather than failing the request.

Selections are kept in `localStorage` under one versioned key. There is no
account and no server-side store.

### `?loadout=` is share state, not identity

A shared loadout travels in the URL as a versioned, encoded payload:

```text
/build?loadout=v1.<base64url>
```

It is decoded and resolved during SSR, so the first render is already correct
and a stranger's query parameter is never trusted on the client. Malformed,
unsupported or oversized payloads render the normal empty builder with a calm
message — never a 500.

**The canonical URL is always plain `/build`**, whatever the query says. A
shared loadout is a state of this page, not a separate product to index, and
the payload never reaches the title, the description or an OpenGraph tag.

A shared loadout takes display precedence over the visitor's own save but is
not adopted until they edit it; at that point the stale `loadout` parameter is
removed with `replaceState`. See `docs/BUILDER.md`.

## `/smart-loadout`

SSR form, interactive result. The server load sends **which colours and styles
can currently produce a complete loadout** (`getSmartAvailability`) plus the
Smart Core and the shared taxonomy labels. It makes no market request, so the
page is free to open: an option that cannot possibly work is never offered, and
nothing is priced until someone presses Generate.

`POST /api/smart-loadout/generate` takes **preferences and nothing else** — a
budget in minor units, a colour, a style, and the two extras:

```jsonc
{
	"budgetMinor": 200000,
	"color": "red",
	"style": "dark",
	"includeKnife": false,
	"includeGloves": false
}
```

No slot ids, no skin slugs, no candidate counts, no item ids. The server owns
the Smart Core, the curated dataset and the candidate logic, so a crafted
payload cannot turn this into an arbitrary market-query endpoint. The schema is
`.strict()` and at least one of colour/style is required; anything else is a
`400` that names no field.

A generation that cannot produce a loadout answers **200 with a reason**
(`no-visual-candidates`, `no-priceable-candidates`, `budget-too-low`,
`market-unavailable`) — the reason is the product's response, not an error, and
each one needs a different answer from the visitor. Only a broken catalog or a
tripped guard is a `503`, and its body says nothing about the upstream.

It is a `POST` someone presses, never a side effect of typing: one generation
prices a few dozen candidates in a single multi-item request. There is no
polling and no refresh button.

A result stops being shown the moment the preferences behind it change. An old
loadout beside new inputs is not out of date; it is answering a question nobody
asked.

### Opening in the builder

"Open in Builder" is the **same `?loadout=` share link** described above — no
second handoff format. A generated loadout therefore arrives at `/build` as a
shared loadout: shown, not adopted, and the visitor's own save untouched until
they edit it. See `docs/SMART_LOADOUT.md`.

## `/knife-gloves`

SSR, with the source in the query. Pairs a curated **knife** with curated
**gloves** or the reverse — never firearms, which `Matches this skin` already
covers.

| Parameter | Meaning                                        |
| --------- | ---------------------------------------------- |
| `skin`    | canonical route slug of the source             |
| `wear`    | exact exterior, honoured rather than defaulted |
| `edition` | skin-page vocabulary; no UI offers it here     |
| `phase`   | skin-page vocabulary                           |

```text
/knife-gloves                                              the picker
/knife-gloves?skin=karambit-crimson-web                    practical default
/knife-gloves?skin=karambit-crimson-web&wear=Factory%20New exactly that one
```

**Canonical is bare `/knife-gloves`**, whatever the query says: the source is a
state of this page, not a separate product to index, and neither it nor a price
reaches the title, the description or an OpenGraph tag.

The loader sends the ~56 curated knives and gloves as picker options, which is
small enough to search in the browser — **there is no matcher endpoint**, and an
endpoint to filter fifty-six records would be a round trip bought for nothing.

Ranking is visual and happens before pricing; one `getManySkinPrices` call
covers the source and up to six counterparts, at most seven item ids. No history.

Every bad selection is **recoverable, not a route error**: an unknown slug, a
firearm and an uncurated knife each answer 200 with an explanation and a working
picker. "Open pair in Builder" reuses the `?loadout=` share codec above. See
[`docs/KNIFE_GLOVES.md`](KNIFE_GLOVES.md).

## `/wishlist`

SSR shell, client-restored body. The authoritative list is `localStorage`, which
the server cannot see and must not pretend to — so it renders the frame, the
title and a stable restoring surface, and the browser fills it in. There is no
user identity anywhere in the product, so there is nothing to look up.

`POST /api/wishlist/resolve` takes **canonical identities only** — a route slug
and an exact variant. The add-time price snapshot and the saved timestamp stay
in the browser; the server has no use for them and must not be handed numbers a
client wrote. The schema is `.strict()`, duplicates are rejected, and the list
is capped at 50.

Resolution is **tolerant**, like `/api/build/resolve`: a saved entry the catalog
no longer has comes back listed as rejected with a 200, never as a failure of
the whole request. The browser prunes exactly those, and only after a successful
response.

Unlike the builder's resolve, this one **prices** — automatically, in one
multi-item request, with no history and no polling. Seeing current prices is the
entire point of opening the page, so asking someone to press a button first
would be asking them to confirm the thing they just asked for.

The page's metadata names no saved skin and no price: a wishlist lives in one
browser. Canonical is `/wishlist`. See [`docs/WISHLIST.md`](WISHLIST.md).

## Notes for when these get built

- **SSR by default.** `/`, `/explore` and `/skins/[slug]` are the indexable surface
  of the product; their content must render on the server.
- **Filters live in the URL.** `/explore?weapon=ak-47&color=red&max=100` must be
  shareable and restorable. Same for search and pagination.
- **Shared loadouts need public URLs** (`docs/CONCEPT.md` § 20). Decide the slug
  scheme before building `/build`, because it constrains persistence.
- `[slug]` for skins must survive variants (wear, StatTrak, Souvenir). Those are
  most likely query params or a nested segment on top of a stable skin slug — decide
  once, deliberately.
- Route groups (`(app)`, `(marketing)`) may be introduced when a second layout shell
  actually exists. Not before.
- Every route needs its loading, empty and error states defined — see
  `docs/FRONTEND_RULES.md`.

## How these routes will get their data

Three mechanisms, picked per case (details in `docs/ARCHITECTURE.md`):

- **`+page.server.ts`** — the default for data a route needs in order to render.
  Runs on the server, so it can hold credentials and call providers.
- **Internal `+server.ts` endpoints** — when the client needs to re-request
  something after first render, or when an endpoint is genuinely useful on its own.
- **TanStack Query** — on top of either, where client-side caching, polling or
  interactive refresh adds something. A price comparison that refreshes without a
  navigation is the obvious candidate.

Dynamic market data comes from real provider APIs through the server layer, not from
static JSON.

No product API routes are defined here on purpose: a `+server.ts` gets created when
a concrete feature needs it, not as part of a route map.

The one exception already in the tree is `GET /api/dev/cs2cap`, a development-only
diagnostic for the CS2Cap integration. It returns 404 outside `dev`, has no UI, and
is not part of the product surface — see `docs/PROVIDERS.md`.
