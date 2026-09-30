# Editorial kits

The source of truth for curated skin sets. Read this before adding a kit or
changing the dataset.

## Why this exists

`docs/CONCEPT.md` describes a product where a visitor arrives wanting a
_look_, not a part number:

> um inventário vermelho · uma AK preta · um loadout azul · skins clean

Explore answers that with filters, once a visitor already knows what to filter
for. A kit answers it before they do: here is a set of skins that genuinely go
together, assembled by someone who looked at them. It is the shortest path from
"I want a red loadout" to five specific skins and their prices.

```text
editorial kit (curated, static)
        +
CS2Cap catalog (objective, cached)
        ↓
kit service — resolve slugs and variants
        ↓
/kits  ·  /kits/[slug]  →  /skins/[slug]?wear=…
```

Kits are **our** product data. CS2Cap has no concept of them.

## What belongs here

Which skins go together, in which order, at which exterior, and one sentence
saying what the set is about.

## What must never go here

Anything dynamic:

```text
price · total · bestProvider · quantity · currency · lastUpdated · availability
```

A kit total depends on five live prices across several marketplaces and moves
by the minute. A number committed to this file is wrong before the commit
lands. The schema is `.strict()` and a test asserts that a kit carries exactly
`slug`, `name`, `description`, `category`, `tags` and `items` — nothing else —
so the dataset cannot quietly grow into a shadow price list.

Also out of scope: popularity, trend or investment scores, "best value"
rankings, and anything that implies a recommendation we cannot justify in one
sentence.

Kit **pricing** is derived at request time and never stored. Nothing in
`src/lib/server/services/kits.ts` imports the market service, and a test
enforces that: `/kits` must cost zero price requests. Live pricing belongs to
`/kits/[slug]` — the one kit a visitor actually opened. See **Pricing a kit**
below.

## Vocabulary

A kit has one `category` and one to four `tags`.

```text
category:  color  style
```

Deliberately tiny. A taxonomy with twenty entries is one nobody applies
consistently, and four kits do not need one.

Tags reuse the skin visual vocabulary from
`src/lib/types/visual-metadata.ts` — `SKIN_COLORS` and `SKIN_STYLES` — rather
than inventing synonyms. "dark" has to mean the same thing on a kit as it does
on a skin, or a future cross-filter is meaningless.

A tag describes the kit's **editorial direction as a whole**. It says nothing
about how any individual skin inside it is classified; skin-level curation is
independently verified and lives in `skin-visual-metadata.json`
(see `docs/VISUAL_METADATA.md`).

Note what this rules out: `Crimson` is a fine kit _name_ and is **not** a
valid tag, because `crimson` is not in the colour vocabulary. Names are
editorial; tags are controlled.

## Identity

A kit item names a skin by its **canonical route slug** — the same identity
Explore, search and skin details use:

```json
{ "skinSlug": "ak-47-redline", "variant": { "wear": "Field-Tested" } }
```

Never an upstream `item_id`. Item ids identify one buyable listing; a kit is
about a skin, and the exterior it wants is stated separately and explicitly.

`variant` is **editorial intent, not a UI default**. A kit may deliberately
want Field-Tested — because the finish looks right at that wear, or because
Factory New is absurd for the set. The resolver treats it as a promise:

> If a kit asks for a Field-Tested that does not exist, that is broken content.
> It fails loudly instead of quietly showing a different exterior — and later,
> pricing a different item.

Omit `variant` and the kit takes the skin's representative variant, the same
one a card in Explore shows.

## Files

```text
src/lib/data/editorial-kits.json   the curated kits
src/lib/schemas/kit.ts             validation
src/lib/types/kit.ts               domain types
src/lib/server/services/kits.ts    dataset + catalog resolution
```

Shape:

```json
{
	"kits": [
		{
			"slug": "midnight",
			"name": "Midnight",
			"description": "One sentence. Cards have no room for a paragraph.",
			"category": "style",
			"tags": ["dark", "minimal", "black"],
			"items": [{ "skinSlug": "ak-47-black-laminate", "variant": { "wear": "Field-Tested" } }]
		}
	]
}
```

**Array order is editorial order.** Kits appear on `/kits` in file order, and a
kit's **first four items** compose its cover collage. Reordering the JSON
reorders the product — that is the intended editing surface, and it is why
there is no sort control on `/kits`.

## The shipped kits

Four, all curated by looking at catalog images:

| Kit        | Category | Tags                 | Skins |
| ---------- | -------- | -------------------- | ----- |
| Crimson    | color    | red, black           | 5     |
| Monochrome | color    | white, black, clean  | 4     |
| Cobalt     | color    | blue                 | 5     |
| Midnight   | style    | dark, minimal, black | 5     |

Every kit spans the rifle and pistol slots a loadout actually has (AK-47, AWP,
M4A1-S, USP-S, Glock-18) rather than five rifles that happen to share a colour.

## Curation workflow

1. Decide the direction first — a colour or a visual style, in a sentence.
2. Pick candidate skins from the catalog **by looking at their images**, not
   their names. This is the step that cannot be skipped; see below.
3. Check each candidate's real exteriors and choose the one the set wants.
4. Put the four strongest-looking items first: they become the cover.
5. Add the kit to `editorial-kits.json`; tag it from the shared vocabulary.
6. Run `pnpm test:unit` — schema, vocabulary, duplicates and shape are checked.
7. Load `/kits` and `/kits/<slug>` and look at them. A kit that validates and
   reads badly is still a bad kit.

### Names lie

The single most important rule here, and the reason curation is manual.

Skins were rejected during curation for exactly this:

- **AWP | Atheris** and **AWP | Containment Breach** sound like they belong in
  a blue set. They are green.
- **AK-47 | Blue Laminate** _is_ blue; **AK-47 | Black Laminate** is not a
  darker version of it — it is a different finish that happens to share a word.
- **Redline** is red **and** black, which is why Crimson pairs it with dark
  bodies rather than calling the kit "red".

Deriving a kit from names produces something plausible, wrong, and invisible
until someone looks at the page.

## Validation

Hand-written data has no API contract protecting it, only review. It is parsed
as strictly as an external payload:

- slugs are lowercase and hyphenated, and unique across the file — a duplicate
  fails loudly, by name;
- `name` (≤ 40 chars) and `description` (≤ 200) are non-empty;
- `category` comes from `KIT_CATEGORIES`;
- 1–4 tags, all from the shared visual vocabulary, no repeats;
- 3–8 items (`KIT_MIN_ITEMS` / `KIT_MAX_ITEMS`), no skin twice in one kit;
- `variant.edition` is one of `normal` / `stattrak` / `souvenir`;
- unknown fields are rejected at every level (`.strict()`).

What the schema **cannot** check is whether a referenced skin or exterior
actually exists — that needs the catalog. `resolveKit` does it at request time
and raises `KitResolutionError`, which names the kit and the item.

### Verifying against the real catalog

The unit suite covers everything checkable offline. Existence of the 19
referenced skins and their 19 preferred exteriors was verified against a live
`item_type=Weapon` fetch (21,524 catalog entries): **0 missing skins, 0 missing
exteriors**. `/kits`, `/kits/crimson`, `/kits/monochrome`, `/kits/cobalt` and
`/kits/midnight` were each loaded against the real API and returned 200 with
the expected skin counts, and `/kits/not-real` returned 404.

Re-run that check after editing the dataset by loading `/kits` against the real
API once — a broken reference cannot render, so a 200 is the proof. Do not
script a request per skin; the index is one cached fetch.

## Pricing a kit

Editorial content says _what_ a kit is. Everything about money is worked out
fresh, on the server, for the kit that was opened:

```text
resolved editorial kit
        ↓
exact variant per item  (ResolvedKitItem.variant.itemId)
        ↓
multi-item market service   batch OR bounded individual
        ↓
pure strategy algorithms    src/lib/features/kits/
        ↓
SSR page
```

`/kits` stays price-free. Pricing four kits to render a listing would mean
pricing every item of every kit before anyone has chosen anything.

### The exact variant, all the way through

A kit item is priced on `variant.itemId` — the single catalog id of the
exterior the kit names. The same id is what the page displays, what the "View
offer" link points at, and what the totals are built from. There is never a
case where one wear is priced and another shown.

`editorial-kits.json` still holds no item ids. It names a skin by slug and a
variant in our own vocabulary, and the id is resolved at request time. An id
in the dataset would be an upstream identifier baked into product content.

If a named exterior stops existing, the kit is broken content and
`resolveKit` says so. It is never repriced against a different one.

### Complete totals only

**A kit total is shown only when every item has a usable quote.** A total
assembled from four of five items looks exactly like one assembled from five,
and nothing on the page would tell a visitor which they were reading. When
pricing is incomplete the page says `Total unavailable` and how many items are
missing, and the items that do have prices still show them.

Three per-item states, kept apart:

| State     | Copy                            | Means                               |
| --------- | ------------------------------- | ----------------------------------- |
| priced    | the price and its marketplace   | at least one usable current offer   |
| no quotes | `No current prices`             | loaded; nothing is listed right now |
| error     | `Price temporarily unavailable` | the request failed                  |

The last two are different answers and must never be merged: one is a fact
about the market, the other a fact about us.

A quote is usable only if it is not `stale` and its amount is a positive
integer. The service already filters on both; the strategies filter again,
because a total is the number this product is judged on.

### Lowest price

Buy every item wherever it is cheapest right now. Ties go to the lexically
first provider id so the same data always produces the same plan.

It is called **Lowest price**, never "best", "optimal" or "guaranteed
cheapest". Prices move after the page renders.

### Fewer marketplaces

Buy from as few marketplaces as possible, and as cheaply as possible within
that. Strictly in that order — no weighting, because pricing the convenience
of one fewer account against a few reais is a judgement we would be inventing.

**Exact, not greedy.** Taking the marketplace that covers the most items and
repeating is the obvious approach and it is wrong: a marketplace covering four
of six items can force a second _and_ a third, where two marketplaces covering
three each would have done. That is the difference between telling someone
they need three accounts and two.

So the search runs over **item coverage**, not provider combinations. The state
is the set of items already assigned — at most `2^8` = 256 — and each step
gives one marketplace a subset of the items it can supply; fixing the lowest
unassigned item at each step keeps every plan reachable exactly once. Both cost
and marketplace count only grow, so comparing states lexicographically finds
the true optimum.

```text
N <= 8   (KIT_MAX_ITEMS)
```

**That bound is the reason this is affordable**, and it is the editorial kit
size limit rather than an arbitrary cutoff. A builder with dozens of slots
needs a different algorithm, not a larger constant — `buildFewerMarketplacesPlan`
returns nothing above the limit rather than pretending.

A unit test cross-checks the result against exhaustive enumeration on 120
randomised kits. If the two ever disagree, the DP is wrong.

### Tie-breaking

Deterministic at every level, and pinned by tests:

1. fewest marketplaces;
2. lowest total;
3. the assignment's provider ids, compared as a string.

The same quotes always produce the same plan, whatever order they arrived in.

### When both strategies agree

Often the cheapest plan already uses the fewest marketplaces. The page then
shows one plan and says so, rather than offering a choice that is not a choice.

### Steam comparison

Only when **every** item has a usable `steam` quote, in the same currency. A
"Steam total" missing one skin is not a Steam total — it is a smaller number
that looks like one, and every saving printed next to it would be wrong.

Steam is identified by its provider key (`steam`), named once in
`purchase-strategy.ts`. Never by display name: a directory that starts saying
"Steam Community Market" would silently break the comparison.

The comparison is against the **lowest-price** total only. Comparing every
strategy to Steam would be three numbers answering a question nobody asked.

### Currency

Every quote in a plan must share one currency. We only ever request BRL, so a
mismatch means something changed underneath us — and the answer is no total,
not a converted one. There is no FX in this product.

### What is not modelled

**No fees.** Buyer fees, seller fees, withdrawal and cash-out costs differ by
marketplace and by transaction flow, and normalized data does not reliably
describe a buyer's checkout total. The comparison is of current lowest asks,
and the page says exactly that:

> Totals use current lowest listed prices. Final checkout prices may differ
> because listings can change and marketplaces may apply fees or other charges.

Once, near the totals — not repeated on every row.

Also absent: percentage savings, "open all offers", price alerts, refresh
buttons and polling. The price cache is five minutes and upstream moves on a
similar cadence; a refresh button would mostly re-render the same numbers.

### Offer links

Each plan line keeps its own `MarketQuote`, so the "View offer" link is that
quote's tracked redirect. Nothing is constructed: a quote that arrives without
one simply shows no link. **Batch responses carry no redirect** — the published
contract has no `link` field — so batch mode shows prices without offer
buttons. That is the one visible difference between the two transports.

## Routes

| Route          | What it is                                              |
| -------------- | ------------------------------------------------------- |
| `/kits`        | The catalog. Cards only, no filter or sort — four kits. |
| `/kits/[slug]` | One kit: cover, description, direction, and its skins.  |

Both are server-rendered. An unknown slug is a 404, never a fallback to the
first kit. A catalog outage is a 503 at route level, because a kit is nothing
without the skins it names — but a **market** outage is not: the kit still
renders, without totals. Kit identity is not market data.

Switching purchase strategy issues no request. Both plans are computed on the
server from the same quotes, so the control only chooses which one is shown.

Each item on a kit page links to `/skins/[slug]` **at the exterior the kit
intends**, built with `skinVariantSearch` — the same helper the skin page uses,
so a kit's Field-Tested AK lands on the Field-Tested AK and not the default.
