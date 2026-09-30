# Components

Where a component belongs. Decide this _before_ creating the file — moving
components later is how a `components/` folder turns into a junk drawer.

## The categories

```text
src/lib/components/
├── ui/        generic primitives — no product knowledge
├── layout/    application shell
├── skin/      a skin and its attributes
├── market/    prices, marketplaces, comparison
├── loadout/   the user's inventory build
├── kit/       curated/generated skin sets
├── smart-loadout/  a generated loadout's result lines
├── knife-gloves/   the knife and gloves pairing page
├── wishlist/       saving a skin, and the saved list
├── home/           the front door's own pieces
└── search/    search, filtering, discovery
```

## Provider-independent by construction

Presentation components consume **normalised application data**, never a provider's
raw response.

A future `PriceComparison.svelte` receives an already-normalised list of prices and
renders it. It does not know that CSFloat nests its price differently from Skinport,
does not branch on a marketplace name to read a field, and does not parse an upstream
payload. That translation happens server-side in the provider's own mapper, behind an
application service in `src/lib/server/services/` — see `docs/ARCHITECTURE.md`.

The practical test: if adding a fifth marketplace would require editing a component,
the boundary is in the wrong place.

## The test

Ask: **would this component make sense in a completely different product?**

- Yes → `ui/`.
- No → the domain folder whose vocabulary it speaks.

A `Button` makes sense anywhere. A `SkinWearBadge` does not. If a component takes a
`skin`, a `price` or a `loadout` prop, it is not a primitive.

## `ui/` — primitives

shadcn-svelte components, built on Bits UI. Currently installed: button, input,
input-group, textarea, badge, skeleton, separator, dialog, dropdown-menu, tooltip,
popover, select, tabs, slider, sheet, command.

Rules:

- **This folder is vendored.** The shadcn-svelte CLI generates and regenerates it.
  Add components with `pnpm dlx shadcn-svelte@latest add <name>`, not by hand.
- Local edits are allowed but must be deliberate and minimal — a CLI update can
  overwrite them.
- **Nothing domain-specific goes here.** No skins, no prices, no marketplaces.
- Never hand-roll a primitive that exists here or in Bits UI.

## `layout/` — application shell

Structural chrome that is not tied to one product area. Built:

| Component              | Does                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `AppHeader.svelte`     | Sticky 64px header: brand link, desktop nav, mobile trigger      |
| `DesktopNav.svelte`    | Full-height nav with the active-section indicator (`md:` and up) |
| `MobileNav.svelte`     | Sheet-based menu below `md:`, closing on selection               |
| `PageContainer.svelte` | The horizontal frame: gutters and max width                      |
| `AppFooter.svelte`     | Brand, one-line description, repeated navigation                 |

Rules that hold for these:

- **Navigation is defined once**, in `$lib/config/site.ts`. Desktop and mobile render
  the same `mainNav` array; neither keeps its own copy of the labels or hrefs.
- **Every page wraps its content in `PageContainer`.** It owns the gutters and the
  width cap, which is what keeps the header's edges aligned with the content beneath
  it. A route that sets its own `max-w-*` and padding breaks that alignment.
- The root layout owns the single `<main>` landmark and its vertical rhythm, so no
  route adds its own top padding to clear the header.
- Sidebars will live here too when Explore needs one.

Every route is a real page now; see `docs/ROUTES.md` for the map.

## `skin/` — a skin and its attributes

Presentation of a skin: image, name, weapon, collection, rarity, wear,
StatTrak/Souvenir. Built:

| Component                 | Responsibility                            | Key props                                                              |
| ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `SkinCard.svelte`         | A skin in a grid, image-first             | `skin`, `variant?`, `priceMinor?`, `currency?`, `priceLabel?`, `href?` |
| `SkinImage.svelte`        | Artwork in a fixed 4:3 box, with fallback | `src?`, `alt`, `decorative?`, `loading?`                               |
| `SkinRarity.svelte`       | Rarity dot plus its name                  | `rarity?`                                                              |
| `SkinWearBadge.svelte`    | Exterior, neutral styling                 | `wear?`                                                                |
| `SkinCardSkeleton.svelte` | Card-shaped placeholder                   | —                                                                      |

What they must not do:

- **No data loading.** No service call, no query, no `fetch`. Prices and skins
  arrive as props; the page owns the loading.
- **No raw upstream fields.** They speak `Skin`, `SkinVariant`, `MarketQuote` and
  `MarketProvider` — never `lowest_ask`, `market_hash_name` or `is_stattrak`.
- **No float, item id or market hash name on a card.** Those are identifiers and
  listing detail, not something a visitor scanning a grid needs.
- **No route knowledge.** `SkinCard` takes an already-resolved `href`; the page
  knows the route, the card does not.

Skin detail adds:

| Component                    | Responsibility                             | Key props         |
| ---------------------------- | ------------------------------------------ | ----------------- |
| `SkinVariantSelector.svelte` | Exterior, edition and phase, as real links | `skin`, `variant` |
| `SkinInfo.svelte`            | Objective catalog facts                    | `skin`, `variant` |

`SkinVariantSelector` builds every option from the variants the skin actually has, so
it can never offer something unbuyable, and renders no control where there is only
one choice. `SkinInfo` shows no technical identifier and **no float** — those identify
items for our code, they do not inform a purchase.

`SkinCard` is route-agnostic on purpose — Explore, search results, related skins
and kit pickers all use the same one. There is deliberately a single variant of
it; sizes come from the grid cell it fills.

Visual recommendations **do** use it, through one thin wrapper:

| Component                    | Responsibility                     | Key props                                              |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `SkinRecommendations.svelte` | A titled grid of recommended skins | `heading`, `description`, `items`, `id`, `maxColumns?` |

There is **no recommendation card**. `SkinRecommendations` renders `SkinCard`
with `showPrice={false}`, which is load-bearing rather than cosmetic: no price
was requested for these, and a card reading "Price unavailable" would claim we
looked. It renders nothing at all for an empty list, which is how an uncurated
skin ends up with no sections instead of two empty boxes.

The numeric similarity score never reaches the markup. It ranks a short list; it
is not a calibrated percentage, and `docs/RECOMMENDATIONS.md` says why.

Loadout slots and Smart Loadout results do **not** use it: a slot is a
fixed-height cell that has to read as empty or filled, and a Smart Loadout line
is a dense row carrying a price and a marketplace. Stretching one card to cover
three jobs would have produced a card with three modes.

## `market/` — prices and marketplaces

Anything comparing or presenting market data. Built:

| Component                         | Responsibility                   | Key props                                      |
| --------------------------------- | -------------------------------- | ---------------------------------------------- |
| `PriceDisplay.svelte`             | A price, in minor units          | `amountMinor?`, `currency?`, `label?`, `size?` |
| `PriceUnavailable.svelte`         | Neutral "no usable price" state  | —                                              |
| `BestPriceBadge.svelte`           | Marks the cheapest usable quote  | —                                              |
| `ProviderLogo.svelte`             | Marketplace logo at a fixed size | `provider`, `decorative?`                      |
| `ProviderPriceRow.svelte`         | One marketplace's offer          | `quote`, `provider?`, `best?`                  |
| `ProviderPriceRowSkeleton.svelte` | Row-shaped placeholder           | —                                              |

Skin detail adds:

| Component                  | Responsibility                             | Key props                                |
| -------------------------- | ------------------------------------------ | ---------------------------------------- |
| `PriceComparison.svelte`   | Best-price summary plus every provider row | `rows`, `best`, `bestProvider`, `failed` |
| `PriceHistoryChart.svelte` | 30 days of closes, with a 7D/30D range     | `points`, `currency`                     |

`PriceComparison` receives quotes already joined with providers and already sorted;
it fetches nothing. `PriceHistoryChart` serves both ranges from the one loaded series
— switching never touches the network — and prints the headline figures as text
beside the chart, so the numbers are available without reading a picture.

What they must not do:

- **Never take decimal money.** `amountMinor` is an integer in the currency's minor
  unit; `formatMoney` does the conversion once, at render.
- **Never present a non-price as a price.** Zero, negative and fractional amounts
  fall through to `PriceUnavailable` — "R$ 0,00" or "free" would be the most
  damaging bug this product could ship.
- **Never fetch the provider directory.** The caller passes a `MarketProvider`;
  the row falls back to the provider key if none is given.
- **Never invent a marketplace URL.** The row links out only when the quote carries
  a tracked `redirectUrl`, and stays informational otherwise. No dead controls.
- **Never call a lowest ask an average, a last sale or a valuation.**

Savings and best price use **success green**, never brand amber (see
`docs/DESIGN_SYSTEM.md`).

## `loadout/` — inventory building

The builder: a place for each weapon, and what the chosen set costs. Built:

| Component                     | Responsibility                                     | Key props                     |
| ----------------------------- | -------------------------------------------------- | ----------------------------- |
| `LoadoutSection.svelte`       | One category of slots, with its filled count       | `label`, `slots`, `card`      |
| `LoadoutSlot.svelte`          | One place: empty, filled, and its actions          | `config`, `option?`, `price?` |
| `LoadoutSkinPicker.svelte`    | Choosing a skin and its exact version, in a Dialog | `slot`, `open`, `onselect`    |
| `LoadoutVariantPicker.svelte` | Exterior, edition and phase as client state        | `option`, `selection`         |
| `LoadoutSummary.svelte`       | Progress, the price panel, and Clear loadout       | `filled`, `total`, `status`   |
| `LoadoutPriceSummary.svelte`  | Pricing status, the total and the Steam comparison | `status`, `pricing?`          |

**An empty slot is a choice, not a loading state.** No skeleton — nothing is
coming until someone picks a skin — so it is a real, obviously pressable
control that says what pressing it does. Once filled it stops being one big
button, because Change and Remove cannot nest inside a slot-sized button.

**The picker mutates nothing.** The draft skin and variant live inside the
dialog until `Add to loadout`; cancelling throws them away. It also asks for no
prices: browsing the catalog is free, and a picker that quietly priced every
option would spend a metered quota on window shopping.

**`LoadoutVariantPicker` reuses the skin page's logic, not its UI.**
`SkinVariantSelector` renders links because a variant change there is a
navigation; in the builder it is client state, so links would be wrong. Both
call the same `resolveVariant`, so neither can offer a combination that does
not exist.

**No component here fetches CS2Cap**, and none computes a total: pricing
arrives as props from the page, which asked for it once, when the visitor did.

**No offer links.** Batch pricing carries no redirect URL, so a "View offer"
button would appear or vanish with deployment configuration. Marketplace
comparison is the skin page's job, which every filled slot links to at its
exact variant.

**The share link is never rendered by default.** It is thousands of characters,
and a permanent wall of base64 in the sidebar helps nobody; a selectable field
appears only when the clipboard refuses and there is otherwise no way to get the
link out. Feedback is the button briefly reading `Link copied`, because there is
no toast primitive here and one confirmation does not justify adding one.

**`LoadoutSummary` reports state, it does not decide it.** Whether a loadout is
shared, restoring, or has selections that could not be restored is the builder's
judgement; the summary renders `origin`, `hydration` and `rejectedCount`. The
shared badge is a **word**, not just a colour, and the recovery notice says how
many selections were lost rather than dropping them quietly.

Exactly one live region in the summary — the pricing status. The slot count
changes on every selection, and announcing that each time is noise.

`LoadoutSection` takes its slot renderer as a snippet called `card` rather than
`slot` — the latter is reserved markup in Svelte.

## `kit/` — curated sets

Editorial skin sets: what a kit is and what is in it. Built:

| Component              | Responsibility                                   | Key props |
| ---------------------- | ------------------------------------------------ | --------- |
| `KitCard.svelte`       | A kit in the catalog grid, cover-first           | `kit`     |
| `KitImageStack.svelte` | A kit's cover, composed from the skins it holds  | `items`   |
| `KitItemList.svelte`   | The kit's skins, each linked at its own exterior | `kit`     |

**The skins are the cover.** `KitImageStack` lays the first four items out in a
2×2 CSS grid — no generated artwork, no stored collages, nothing to regenerate
when the dataset changes. Editorial order in the JSON therefore decides what a
kit looks like, which is the intended editing surface. The stack is
`aria-hidden`: it is the same four skins the text already names.

**No prices, anywhere in this folder.** A kit total depends on live market data
across several marketplaces, and an editorial file cannot promise a number. A
card that quietly said "Price unavailable" would be claiming we tried.

`KitItemList` builds each link with `skinVariantSearch`, the same helper the
skin page uses, so a kit's Field-Tested AK lands on the Field-Tested AK rather
than the default. It takes the shared `SkinImage`, `SkinRarity` and
`SkinWearBadge` rather than restyling those facts — a wear badge must look the
same on a kit page as in Explore.

Kit pricing and purchase plans:

| Component                      | Responsibility                                       | Key props              |
| ------------------------------ | ---------------------------------------------------- | ---------------------- |
| `KitPriceSummary.svelte`       | The kit total, the Steam comparison, the disclaimer  | `plan?`, `steam?`      |
| `KitItemPriceRow.svelte`       | One skin: identity, variant, cheapest offer          | `priced`, `providers?` |
| `KitPurchaseStrategy.svelte`   | The two plans and the control that switches them     | `plans`, `providers?`  |
| `PurchaseProviderGroup.svelte` | Everything one marketplace supplies, plus a subtotal | `group`, `providers?`  |

**They receive plans, they do not compute them.** The strategy algorithms are
pure functions in `$lib/features/kits/`, run on the server; these components
render their output. Switching strategy is therefore a `$state` flip with no
request behind it — both plans arrived with the page.

**A total appears only when the whole kit is priced.** `KitPriceSummary` takes
no plan when pricing is incomplete and says `Total unavailable` with a count,
rather than adding up whatever happened to load. A partial subtotal would look
exactly like a complete one.

**Per-item states stay distinct.** `No current prices` (loaded, nothing listed)
is not `Price temporarily unavailable` (the request failed). One is about the
market, the other about us.

**No offer link is ever constructed.** A "View offer" button exists only where
the quote carries its own tracked redirect; batch responses carry none, and the
row simply shows its price. There is deliberately no "open all offers".

`KitItemPriceRow` keeps the price _outside_ the skin link — nesting it would
make the whole row one target whose accessible name recited the price — and
shows only the cheapest offer. The full per-marketplace comparison is the skin
page's job, and repeating it under each item would bury the purchase plan.

These components are covered by the same boundary test as `skin/` and `market/`:
no server import, no raw upstream field, no data loading of their own.

## `smart-loadout/` — a generated result

One component, because a generated loadout is a list and the page owns the
summary:

| Component                 | Responsibility                             | Key props |
| ------------------------- | ------------------------------------------ | --------- |
| `SmartLoadoutItem.svelte` | One chosen skin: slot, finish, wear, price | `item`    |

It shows the **exact variant that was priced** — the same one the link opens
and the same one the total is built from — by building the href from the
variant the optimizer chose rather than re-deriving it. A link that disagreed
with the price beside it would be the one bug this component can have.

It takes the shared `SkinImage`, `SkinRarity`, `SkinWearBadge` and
`PriceDisplay`. A wear badge looks the same here as in Explore.

**No offer button.** Batch pricing carries no tracked redirect, and a button
that appeared or vanished with deployment configuration would be worse than
none. Marketplace comparison lives on the skin page.

Everything else about a generation — the total, the budget, the Steam
comparison, the failure states, "Open in Builder" — is the route's, because it
is about the loadout as a whole rather than about one line of it.

## `knife-gloves/` — pairing a knife with gloves

| Component                       | Responsibility                                | Key props                             |
| ------------------------------- | --------------------------------------------- | ------------------------------------- |
| `KnifeGloveSourcePanel.svelte`  | The skin being matched, and its exterior      | `source`                              |
| `KnifeGloveMatchCard.svelte`    | One counterpart, its price and the pair total | `match`, `detailHref`, `builderHref?` |
| `KnifeGloveSourcePicker.svelte` | Choosing a source from the curated equipment  | `options`, `label?`, `selectedSlug?`  |

All three are **presentational and fetch nothing**. `KnifeGloveMatchCard`
receives every price, total and link already prepared: the route computes the
builder share link and the skin-detail href, because a card should not know how
loadouts are encoded.

It is deliberately **not `SkinCard`**. A match carries two prices and two
actions; widening the catalog card to cover that would have given every grid in
the product a mode it never uses. The comparison is `SmartLoadoutItem`, which
exists for the same reason.

The picker searches the ~56 curated options locally and renders each one as a
**link**, so choosing a source is an ordinary navigation rather than client
state. It uses the vendored `Command` dialog rather than a hand-rolled
combobox.

## `wishlist/` — saving a skin for later

| Component               | Responsibility                                | Key props                                   |
| ----------------------- | --------------------------------------------- | ------------------------------------------- |
| `WishlistButton.svelte` | Saves or removes the exact variant on screen  | `skinSlug`, `variant`, `currentPrice?`      |
| `WishlistItem.svelte`   | One saved skin, now against when it was saved | `item`, `baseline?`, `addedAt?`, `onremove` |

`WishlistButton` is the one component in the product that **touches
`localStorage` directly**, which is why it starts unsaved and corrects itself
after hydration: any other initial value would be a guess the server cannot
make and hydration then contradicts. It is a toggle rather than an add button
that goes dead, because undoing a mistaken save should happen where the save
did. Membership is exact-variant-specific, so switching exterior correctly
flips it back to "Add to wishlist".

`WishlistItem` is presentational and fetches nothing. It is deliberately **not
`SkinCard`**: it carries two prices, a movement line and a destructive control.
The baseline arrives as a prop because only the browser has it — the server was
never told.

Neither renders a percentage, and the movement line states its direction in
words so it does not depend on colour.

## `home/` — the front door

| Component                    | Responsibility                              | Key props                              |
| ---------------------------- | ------------------------------------------- | -------------------------------------- |
| `HomeSkinSearch.svelte`      | The hero search field and its results panel | none                                   |
| `ProductWorkflowCard.svelte` | One thing someone can do, as a link         | `title`, `description`, `href`, `icon` |

Only two, on purpose. Everything else on the homepage is plain markup in the
route — a component per paragraph would be indirection with nothing behind it.

`HomeSkinSearch` shares `createSkinSearch` with the header's `GlobalSearch`, so
the debounce, the endpoint, the threshold and the ranking are the same code.
What differs is presentation: an always-visible field with a results panel,
rather than a dialog. Its label is **"Search for a skin"**, deliberately
different from the header trigger's "Search skins" — two controls with the same
accessible name on one page is an ambiguity for anyone navigating by name.

The homepage otherwise reuses what already exists: `KitCard` for the preview,
`SearchResultItem` for results, `PageContainer` for the shell.

## `search/` — discovery

Explore's catalog controls. Every one of them navigates: the URL is the filter
state, so nothing here holds state of its own.

| Component                    | Responsibility                                        |
| ---------------------------- | ----------------------------------------------------- |
| `ExploreSearch.svelte`       | The catalog text filter, as a plain `GET` form        |
| `ExploreFilters.svelte`      | The filter set, shared by the sidebar and the sheet   |
| `FilterSelect.svelte`        | One filter as a select; navigates on change           |
| `ExploreFiltersSheet.svelte` | The same filters in a Sheet, below `lg`               |
| `ExploreSort.svelte`         | Result ordering                                       |
| `ActiveFilters.svelte`       | Removable chips plus clear-all                        |
| `ExplorePagination.svelte`   | Page links, with no link where there is nowhere to go |

What they must not do:

- **No local filter state.** Controls build a URL and navigate; the server decides
  what the results are. Nothing is held in a store or `localStorage`.
- **No hand-built query strings.** Every link comes from
  `$lib/features/skins/explore-url.ts`, which owns the page-reset rule.
- **No duplicated filter definitions.** Desktop and mobile render the same
  `ExploreFilters`; a filter cannot exist on one and not the other.
- **No upstream shapes.** Filter vocabularies arrive as plain string lists prepared
  on the server.

`ExploreSearch` filters that page only. Global search is separate:

| Component                    | Responsibility                                          |
| ---------------------------- | ------------------------------------------------------- |
| `GlobalSearch.svelte`        | The command dialog: shortcut, query, states, navigation |
| `GlobalSearchTrigger.svelte` | The header button that opens it                         |
| `SearchResultItem.svelte`    | One dense result row                                    |

What they must not do:

- **Never call CS2Cap or a server service.** The browser talks to
  `/api/search/skins`; that endpoint talks to the catalog service.
- **Never fetch prices.** Search is a navigator, not a comparison view — no
  prices, no providers, no charts, no variant lists.
- **Never build a second slug.** Results link with the slug the catalog index
  assigned, so a search result and an Explore card open the same URL.
- **Never rebuild focus trapping, arrow-key navigation or dialog ARIA.** The
  Command and Dialog primitives own those.

`SearchResultItem` is deliberately not a `SkinCard`: a palette row needs density,
a grid cell needs presence.

## Naming

- Files: `PascalCase.svelte` for components, matching the exported name.
- Prefix domain components with their domain (`SkinCard`, `LoadoutSlot`) — it makes
  imports self-documenting and search trivial.
- `ui/` keeps shadcn's own lowercase folder-per-component convention. Leave it alone.

## Where things are _not_

- Not a single flat `components/` folder.
- Not a large reusable component defined inline in a `+page.svelte`. Routes compose
  components; they don't define the library.
- Not business logic inside a presentation component — that lives in
  `src/lib/features/<feature>/`.

None of the domain components above exist yet. This document defines placement for
when they do.
