# Knife + Gloves matcher

`/knife-gloves` pairs a curated knife with curated gloves, or the reverse, and
shows what each one and the pair currently cost.

```text
Knife  → matching Gloves
Gloves → matching Knives
```

Never firearms. Cross-equipment discovery already exists as `Matches this skin`
on any skin page; what that section cannot do is rank the other twenty-four
candidates, because it spends five of its six slots elsewhere. This page is that
one question, answered properly.

## The pipeline

```text
?skin=<slug>[&wear=…]
        ↓  curated visual metadata, no I/O
   opposite category, ranked by similarity
        ↓  cut to 6, one practical variant each
   ONE multi-item price request (≤ 7 item ids)
        ↓
   source panel + pair cards → Builder share link
```

**Visual first, then price, and never back.** The order is the design: the
ranking is settled before the market is asked anything, and nothing reorders it
afterwards. A cheaper pair is not a better-looking pair.

## Where the code lives

| File                                               | Owns                                      |
| -------------------------------------------------- | ----------------------------------------- |
| `src/lib/features/recommendations/knife-gloves.ts` | slot identity, opposite category, ranking |
| `src/lib/schemas/knife-gloves.ts`                  | query state and the link builder          |
| `src/lib/types/knife-gloves.ts`                    | source, match, price, pair total          |
| `src/lib/server/services/knife-gloves.ts`          | resolution, candidates, pricing           |
| `src/routes/knife-gloves/`                         | the page                                  |
| `src/lib/components/knife-gloves/`                 | source panel, match card, picker          |

## One score, everywhere

The matcher calls `visualSimilarity` and honours `MIN_VISUAL_SIMILARITY_SCORE` —
the same function and the same threshold as `Similar skins` and
`Matches this skin`. There is deliberately **no knife-and-glove aesthetic
score**: two skins that match on a skin page must match here, or the product
would be quietly disagreeing with itself. See
[`docs/RECOMMENDATIONS.md`](RECOMMENDATIONS.md).

## Curated only

The pool is the verified dataset: **31 knives and 25 gloves** today, out of 161
curated records. Nothing is inferred for an unclassified item, and no uncurated
knife is used as filler.

That has consequences the product states rather than hides:

- An **uncurated** knife or glove says so and offers the picker again.
- Six of the 31 curated knives have no curated glove that clears the threshold.
  Those say **"No strong curated matches yet."** The bar is never lowered to
  fill the grid.
- The Skin Details CTA only appears for a curated knife or pair of gloves —
  there is no point sending someone to a page that can only tell them no.

## The URL is the selection

```text
/knife-gloves                                             the picker
/knife-gloves?skin=karambit-crimson-web                   practical default
/knife-gloves?skin=karambit-crimson-web&wear=Factory%20New   exactly that one
```

`skin` is the canonical route slug, never an item id. `wear`, `edition` and
`phase` reuse the skin page's vocabulary unchanged, so a CTA link carries over
without translation.

**Canonical is bare `/knife-gloves`.** The source is application state, not a
separate product to index, and the page's metadata never names the selected skin
or a price.

Every failure is recoverable selection state rather than a route error — an
unknown slug, a rifle, an uncurated item. The page answers 200 with the picker
intact. A mistyped query is a bad choice, not a missing page.

## Which variant gets priced

**The source honours what the URL says, exactly.** Someone who arrived from a
Factory New knife is shown and priced that knife, not a cheaper default.

When the URL names no variant, and for every counterpart, the choice is
`pickPracticalVariant` — shared with Smart Loadout rather than reimplemented:

1. Normal edition only. No StatTrak, no Souvenir, and no UI for them here.
2. Field-Tested → Minimal Wear → Well-Worn → Factory New → Battle-Scarred.
3. Ties break on catalog id, so it is reproducible.

A vanilla knife has no exterior, which is a real variant rather than a gap, and
gets no exterior control at all.

Changing the source exterior is a navigation: same slug, new `wear`, new prices.
It does **not** change the ranking, because visual metadata is product-level —
a Factory New glove looks like the Field-Tested one.

## What it asks the market

One `getManySkinPrices` call, with at most **seven** item ids: the source plus
six counterparts. No history — that belongs to the skin page. The provider
directory loads once, and its failure degrades to provider keys.

Counterparts are cut to six **before** pricing, and six is also what renders.
Pricing a spare pool would only help if something could knock a candidate out
after pricing, and nothing can: ranking is visual, and a missing price is shown
rather than hidden.

## Pair totals

```text
pairTotal = source lowest ask + match lowest ask
```

Integer minor units, one currency, both sides present — or **no total at all**.
Half a total presented as a total is worse than none, because it looks complete.

It is the cost of buying each item at its own cheapest marketplace, which may be
two different marketplaces. The page says that once, under the section heading;
repeating the caveat on six cards would be noise.

Quotes are current lowest asks. Stale and non-positive quotes are excluded, as
everywhere else in the product.

## Degrading

| What fails         | What happens                                      |
| ------------------ | ------------------------------------------------- |
| One item's price   | That card says so; its pair total is withheld     |
| The source's price | Matches still render and stay priced; no totals   |
| All pricing        | Visual pairs render, with one page-level note     |
| Provider directory | Prices render with provider keys instead of names |
| The catalog        | The page says so rather than 500ing               |

The pairing is the feature; prices are context.

## Handing a pair to the builder

"Open pair in Builder" is the **existing v1 share codec** — no new format, no
new endpoint, no Builder API:

```text
/build?loadout=v1.<base64url of [["knife",…],["gloves",…]]>
```

Exactly two selections, with the exact variants shown and priced. Because it is
an ordinary shared loadout it is _shown, not adopted_: the visitor's own saved
loadout survives until they edit it. Phase 12 owns that behaviour and this
feature does not special-case it.

## Discoverability

The Skin Details CTA, and nothing else yet. There is deliberately **no main-nav
entry** — the header already carries Explore, Kits, Build, Smart Loadout and
search, and a fifth item would cost more than it returns. A Home page entry
comes later.

## Known limitations

- **Coverage is the ceiling.** 31 knives and 25 gloves; six of those knives have
  no counterpart above the threshold.
- **No per-card exterior control.** Each counterpart shows one practical
  variant; the skin page is where other exteriors are chosen.
- **No StatTrak or Souvenir UI.** A StatTrak source arriving by URL is honoured,
  but counterparts are always normal edition.
- **Six matches, not twenty-five.** Ranked, not exhaustive.
- **No cheapest-pair search.** Deliberately. Ranking is visual, and a mode that
  sorted by pair total would be a different feature wearing this one's clothes.
