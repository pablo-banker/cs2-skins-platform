# Frontend rules

Practical rules for writing code here. `docs/ARCHITECTURE.md` explains the shape of
the system; this file is what you check yourself against while typing.

## TypeScript

- Strict mode is on and stays on. Never relax `tsconfig.json` to make an error go
  away — fix the type.
- No `any`. Use `unknown` at external boundaries and narrow it (Zod, a type guard).
  If `any` is genuinely unavoidable, isolate it to one line and comment why.
- Avoid type assertions (`as`). An assertion is a claim the compiler can't check; a
  schema parse or a guard usually does the job properly.
- Define a type once. Two identical interfaces in two features means one of them
  belongs a layer down.
- Keep API types and domain types explicit and separate — the shape a marketplace
  returns is not the shape our UI consumes.

## Dependencies

- No new dependency without explicit approval.
- Never a second library for something already covered: icons, animation, charts,
  forms, server state, UI primitives. The list is in `CLAUDE.md`.
- Before reaching for a package, check whether Bits UI, shadcn-svelte or the platform
  already does it.

## Styling

- **No arbitrary colours.** `bg-[#080A0D]` is a bug when `bg-background` exists.
  Every colour comes from a semantic token.
- No inline `style` for anything the token system covers. Inline style is for
  genuinely dynamic values (a computed transform, a CSS variable carrying a runtime
  number).
- Tailwind utilities first. Reach for a component class only when a pattern repeats
  and a component doesn't fit.
- Never duplicate a UI primitive. If a Button variant is missing, extend the existing
  Button.
- Class order is handled by `prettier-plugin-tailwindcss`. Don't fight it.

## Svelte 5

- Runes for new code (`$state`, `$derived`, `$effect`). No new legacy stores.
- **Derive, don't duplicate.** If a value can be computed from other state, it is
  `$derived` — not a second `$state` kept in sync.
- **`$effect` is a last resort.** It is for talking to the world outside Svelte.
  An effect that sets state which another effect reads is a design smell.
- Props via `$props()` with an explicit type. Use `$bindable()` deliberately, not by
  default.
- Prefer snippets over wrapper components for small bits of markup.

## Components

- Components stay small enough to read in one screen. A component doing layout +
  fetching + formatting + interaction is four components.
- **No business logic in presentation components.** A card renders what it is given;
  it doesn't decide which marketplace is cheapest. That belongs in a feature module.
- No premature abstraction. Write it twice, abstract on the third — and only if the
  three uses really are the same thing.
- No barrel file unless it forms a real public module API. Re-exporting one symbol is
  noise.
- Domain components never live in `components/ui`.

## Accessibility

- Semantic HTML. `<button>` for actions, `<a>` for navigation, real headings in
  order, lists for lists. **Never a `div` as a button.**
- Everything reachable and operable by keyboard; tab order follows visual order.
- Visible focus state on every interactive control. Never remove an outline without
  replacing it.
- Use the accessible primitives (Bits UI / shadcn-svelte) for dialogs, popovers,
  dropdowns, tooltips, tabs and sheets. Do not rebuild them.
- Icon-only buttons need an accessible name (`aria-label` or visually-hidden text).
- Decorative icons and images are `aria-hidden` / `alt=""`; meaningful ones get real
  alt text.
- Colour is never the only signal — pair it with text or an icon.
- Respect `prefers-reduced-motion`, including in JS-driven animation.

## Responsive

- Mobile is designed, not degraded. Build the small layout, then enhance upward.
- Use Tailwind's default breakpoints (`md:` for tablet, `lg:` for desktop). Don't add
  custom breakpoints unless a layout genuinely can't be expressed.
- No horizontal page scroll at 320px. Tap targets stay comfortable.
- Desktop filtering: persistent sidebar. Mobile filtering: Sheet.

## Images

Skin images are the main performance risk in this product. Every image needs:

- a fixed aspect ratio reserved before it loads — **no layout shift**;
- explicit `width`/`height`;
- `loading="lazy"` below the fold (and _not_ on the hero image);
- responsive sizing (`srcset`/`sizes`) where sizes really differ;
- WebP/AVIF when we control the asset, CDN delivery where available;
- a skeleton or placeholder while loading, and a defined broken-image fallback.

## External data

Dynamic market data (prices, listings, availability, history) comes from real
external APIs — never from a static JSON file standing in for one. Full picture in
`docs/ARCHITECTURE.md`; the rules you need while writing components:

- **UI components must not know provider-specific API schemas.** A component takes a
  normalised application type. If it references a field name that only CSFloat or
  only Skinport uses, the normalisation is missing.
- **Do not fetch a private API from a `.svelte` component.** Anything needing a key,
  a secret, an auth header, CORS help, normalisation or aggregation goes through the
  SvelteKit server.
- **Never put a secret in a `PUBLIC_*` variable.** `PUBLIC_` means "shipped to every
  browser". Provider credentials belong in private env only.
- **Never hardcode a credential**, not even temporarily, not even in a comment.
- **Never import `$lib/server/**` from browser-reachable code.**
- **Keep network logic out of presentation components.** Components render; loading
  happens in a `load` function, a query, or a feature module.
- **Consume application services, not the CS2Cap integration.** Routes and
  components go through `$lib/server/services/**`; `$lib/server/providers/cs2cap/**`
  is infrastructure and is off-limits outside the server data layer, its own tests
  and development diagnostics.
- **A product route identifies the product; variant state lives in the query.** Do
  not put an exterior in the path — one skin is one page, and its variants are views
  of it. Canonical stays the product URL.
- **Fetch market data for the selected variant only.** Never prefetch every variant's
  prices.
- **Let sections fail independently.** Prices and history failing must not take the
  catalog identity down with them; a missing provider directory must not drop a real
  price.
- **Know which search you are building.** Faceted discovery is URL-driven SSR
  (Explore); interactive find-and-go is client server-state through TanStack Query
  and an internal endpoint (global search). Do not convert one into the other.
- **The browser never calls CS2Cap.** Client-side data goes through an internal
  application endpoint.
- **Faceted filter state lives in the URL**, never in a store, context or
  `localStorage`. A filtered view has to be shareable and reloadable, and that only
  works if the server can answer the URL on its own.
- **Page data loads through SSR services**, not client-side global state. TanStack
  Query is for interactive refreshes later, not for server-driven filtering.
- **Never issue one market-price request per catalog card.** A grid of 24 skins is
  24 upstream calls against a metered API — batch it or omit prices entirely.
  `Promise.all` around an N+1 is still an N+1.
- **"No price was requested" is not "price unavailable".** A catalog grid may render
  without prices; it must not claim a price is missing when nobody looked for one.
- **Domain components never fetch their own market data.** No service call, no
  query, no `fetch` inside a presentational component — data arrives as props and
  the page owns the loading.
- **Money enters a component as integer minor units plus a currency**, never as a
  decimal, and is formatted only by `$lib/formatters/currency`. Never divide by 100
  in a component.
- **Never render a non-price as a price.** Zero, negative and fractional amounts get
  an unavailable state.
- **Use the shared rarity mapping** (`$lib/config/rarity`) rather than an upstream
  hex value.
- **Consume enriched discovery data, never the visual JSON.** A component must not
  import `skin-visual-metadata.json` or `visual-taxonomy.json`; colours and styles
  arrive already attached by the discovery service. A skin with `visual: null` is
  uncurated, not broken — render it normally, just without colour affordances.
- **A kit total requires every item to be priced.** Never render a subtotal of
  the items that happened to load as if it were a complete total — a visitor
  cannot tell the difference. Say the total is unavailable and how many items
  are missing; keep showing the prices you do have.
- **"Nothing is listed" is not "the request failed".** Two different states,
  two different sentences, everywhere prices appear.
- **Purchase strategies are pure integer-money functions.** They live in
  `$lib/features/kits/`, never in a `.svelte` file, and never touch the network
  or an upstream type.
- **Switching strategy must not refetch.** Both plans are computed once, on the
  server, from the same quotes. A control that re-requests is a bug.
- **The kit listing loads no market data.** `/kits` shows no price and no price
  skeleton; only the kit someone opened gets priced.
- **Never construct a marketplace URL.** Link out only through the redirect a
  quote actually carries; where there is none, show no link.
- **Do not model fees.** Totals compare current lowest asks, the copy says so
  once, and nothing claims a checkout price.
- **Persist canonical selection identity only** — slot, slug, variant. Never a
  price, a provider, an item id or anything else the catalog or the market
  owns; re-resolve those instead.
- **Builder storage is versioned**, under one namespaced key, and the version is
  checked rather than assumed. A payload from a future build is discarded, not
  reinterpreted.
- **Never write state before restoration has resolved.** An empty builder
  written over a saved loadout destroys it; gate persistence on an explicit
  hydration state.
- **Shared state takes display precedence over local persistence**, and viewing
  a shared loadout must not overwrite the visitor's own — adoption happens on
  their first edit, which is also when a stale share parameter is dropped.
- **An invalid exact variant is rejected, never substituted**, whether it came
  from storage, a link, or an editorial file.
- **The builder never loads the full catalog into the browser.** A picker asks
  for one bounded, slot-scoped page; the index stays on the server.
- **A loadout selection is a slot, a skin slug and a variant** in our own
  vocabulary — never an upstream item id, which would tie a saved loadout to
  someone else's database.
- **Price calculation is explicit.** A full loadout is not priced on every
  edit; the visitor asks once, when they are ready.
- **Any edit invalidates a displayed loadout total**, by comparing a
  fingerprint rather than clearing state from each edit path.
- **Empty slots do not make selected-item pricing incomplete.** The total is
  for what is selected, and the copy says so.
- **Builder components never fetch.** Options and prices arrive as props.
- **Curated content is content, not a cache.** `editorial-kits.json` says which
  skins go together and at which exterior — never a price, a total, a provider or a
  timestamp. If a value moves on its own, it is not allowed in a JSON file.
- **A stated variant is a promise, not a hint.** When curated data names an exterior
  or a phase, resolve it exactly; if it does not exist, fail loudly. Substituting a
  different variant means showing — and later pricing — a different item than the
  one that was curated.
- **Curate by looking, never by name.** `AWP | Atheris` and `AWP | Containment
Breach` sound blue and are green. A set derived from names is plausible, wrong,
  and invisible until someone opens the page.
- **Reuse the shared visual vocabulary for tags.** Kit tags come from `SKIN_COLORS`
  and `SKIN_STYLES`; "dark" has to mean the same thing everywhere. A kit's _name_
  may be editorial (`Crimson`), its _tags_ may not.
- **Do not mock dynamic data in production-facing code** unless explicitly asked for
  a fallback.
- **A generator sends preferences, never targets.** The Smart Loadout request
  carries a budget, a colour, a style and two booleans — no slot ids, skin slugs,
  candidate counts or item ids. The server owns the core, the dataset and the
  candidate logic; a client that could name what to price is a market-query
  endpoint wearing a form.
- **Decide the shortlist before spending the budget.** Rank visually, cut to a
  server-owned constant, then price once. A generation that prices everything
  curated is the same bug as an N+1, just further from the grid.
- **Colour is a promise; style is a preference.** Fall back from colour+style to
  colour alone, never to another colour, and say so in the interface when you do.
  A red loadout containing a blue rifle is a wrong answer, not a partial match.
- **A budget is a ceiling, not a target.** Among equally good results, spend less.
  And when a budget does not reach, name the real minimum from what was priced —
  never an estimate, never silence.
- **Do not offer a preference that cannot work.** Compute availability from the
  curated dataset and list only directions that can fill every required slot.
  Warning after a generation is spent is worse than not offering it.
- **Failure reasons are product copy.** Curation gap, pricing gap, budget gap and
  outage need four different answers; "no results" makes someone adjust the wrong
  thing. A failed generation is a 200 with a reason, not an error.
- **Hand work off through the format that already exists.** A generated loadout
  reaches the builder as an ordinary share link — no second handoff format, and no
  quiet overwrite of someone's saved loadout.
- **Visual recommendations use curated metadata only.** Nothing is inferred for an
  unclassified skin, and a source skin with no profile shows **no sections at all** —
  not an empty box, and never an apology for our curation backlog inside the product.
- **Recommendation cards never trigger a market request.** `showPrice={false}`, no
  price, and no "Price unavailable" either: not requested and not found are
  different states, and a card saying the second would be claiming we looked.
- **Similar means the same Builder slot; Matches means a different one.** Same-slot
  alternatives and cross-slot pairings answer different questions, so they are
  different sections. Six alternatives for one weapon under "Matches this skin" is
  the failure the split exists to prevent.
- **Fill cross-slot recommendations one slot at a time.** Every slot gets a turn
  before any slot gets a second, and nothing is invented to reach the limit — fewer
  verified matches means fewer cards.
- **A numeric visual similarity score is internal.** It ranks a short list; it is
  not a calibrated percentage and is never rendered. No "92% similar".
- **Price, rarity and collection are not visual evidence.** A more expensive or
  rarer skin is not a better colour match, and one case is not a design language.
  Never fold market data into an appearance score.
- **One threshold, shared.** `MIN_VISUAL_SIMILARITY_SCORE` gates every visual
  recommendation. Do not add a local constant, and do not lower it because a
  section looks empty — an empty section is a curation signal, not a layout bug.
- **The Knife + Gloves matcher compares opposite categories only.** A knife
  matches gloves and gloves match knives; same-category alternatives are
  `Similar skins` on the skin's own page. Category comes from the Builder slot
  registry, never from a weapon name.
- **Rank visually, then price, and never re-rank.** Cut the candidate list to its
  bound _before_ the market request, so pricing is bounded by a constant. A
  cheaper pair is not a better visual match.
- **A pair total needs both sides, in one currency.** Half a total presented as a
  total is worse than none, because it looks complete.
- **A market failure never removes a visual result.** Prices are context on these
  pages; the pairing or recommendation still renders, with per-item honesty about
  what is missing.
- **Hand a pair to the builder through the existing share codec.** No second
  handoff format, no Builder API, and no special case around the visitor's own
  saved loadout.
- **Wishlist identity is an exact skin and an exact variant.** Two exteriors of
  one skin are two entries with two baselines; never treat the grouped skin as
  saved. Build the key with the shared helper, never by hand.
- **Wishlist is local-only until accounts exist.** Say "Saved on this device",
  never imply sync, and keep saved items out of server-rendered metadata.
- **Wishlist may persist the add-time price snapshot — and nothing else from the
  market.** It is a historical baseline, labelled as such, never reused as
  current price state and never silently refreshed.
- **Current prices load once per visit, for the whole list, with no polling.**
  One multi-item request, no per-card waterfall, and no history for a list.
- **Price movement is buyer-oriented and factual.** Lower, higher, or no change
  — never profit, loss, return, ROI or a percentage, and never a total across
  the list. A wishlist is not a portfolio.
- **Compare only like with like.** No baseline, no current price, or two
  currencies means no comparison — show the current price alone rather than
  inventing one.
- **The homepage makes no automatic market request.** No prices, no providers,
  no history on a cold visit, and none while someone types in the hero search.
  The front door has to stay free.
- **Homepage claims describe what is actually built.** No capability the
  product does not have, and no wording that suggests we sell skins.
- **Never claim popularity without data.** No trending, most-viewed,
  most-searched, user counts, testimonials or ratings — there are no analytics,
  so any of those would be invented.
- **Home links to workflows; it does not reimplement them.** The hero search
  shares the header's query helper rather than copying it, and every section is
  a link to the surface that owns the work.

## States

Every screen that loads data defines four states, not one:

1. **Loading** — skeletons that match the final layout, not a spinner in the void.
2. **Empty** — explains what would be here and what to do next.
3. **Error** — says what failed and offers a retry. Never a blank page.
4. **Success**.

Once real integrations exist there is a fifth: **partial provider failure**. If four
marketplaces are queried and one is down, the comparison still renders the three that
answered and says the fourth is unavailable. One provider failing must not blank out
a comparison that has usable data — a partial answer is the product working, not the
product broken.

Prices additionally need a **freshness** indicator (see `docs/CONCEPT.md` § 23).

None of these states are implemented yet; this is the rule for when they are.

## Animation

- CSS / Tailwind / Svelte transitions for hover, fade, dropdown, modal, scale.
- GSAP only for complex sequences and storytelling — and never imported at module
  scope where SSR will execute it. Load it in `onMount` or behind a dynamic import,
  and check `prefers-reduced-motion` first.

## Before you push

```bash
pnpm check && pnpm lint && pnpm test:unit && pnpm build
```

Don't suppress an error to make one of those pass.
