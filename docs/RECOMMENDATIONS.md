# Visual recommendations

Two sections at the bottom of `/skins/[slug]`:

```text
Similar skins      other skins for the SAME Builder slot that look like this one
Matches this skin  skins for OTHER slots that pair with it
```

They answer different questions, which is why they are two sections and two
functions. Collapsing them produces the failure the split exists to avoid — six
AK-47 alternatives under a heading promising a loadout that goes with the AK-47.

## The flow

```text
source skin + verified visual profile
           + cached catalog + curated metadata
                     ↓
              visual similarity
                     ↓
       Similar skins · Matches this skin
```

**No market service appears anywhere in it.** A skin page has already answered
the price question for the skin someone opened; pricing eight recommendation
cards would be eight more metered requests for cards that deliberately show no
price. A test asserts the service does not even import `./market`.

## Where the code lives

| File                                                       | Owns                                     |
| ---------------------------------------------------------- | ---------------------------------------- |
| `src/lib/features/recommendations/visual-similarity.ts`    | the score: two profiles in, a number out |
| `src/lib/features/recommendations/skin-recommendations.ts` | selection, ranking, slot diversity       |
| `src/lib/server/services/recommendations.ts`               | source + catalog + curation → sections   |
| `src/lib/components/skin/SkinRecommendations.svelte`       | a titled grid of `SkinCard`s             |

The two feature modules are pure: profiles and skins in, recommendations out, no
catalog read, no dataset lookup, no I/O. That is what lets the scan strategy be
replaced later without touching the semantics.

## The score

Five weights, and no more:

| Pairing                                | Weight |
| -------------------------------------- | ------ |
| source primary ↔ candidate primary     | 4      |
| source primary ↔ candidate secondary   | 2      |
| source secondary ↔ candidate primary   | 2      |
| shared style                           | 2      |
| source secondary ↔ candidate secondary | 1      |

A colour that defines **both** skins is the strongest thing two skins can share.
A defining colour meeting a supporting one is worth half that, in either
direction — the relation is symmetric, because "looks like" is. A shared style
sits alongside those, and two skins that merely share a trim colour barely
register.

Colours and styles are walked in **taxonomy order**, not in the order a record
lists them, so the evidence a recommendation reports is stable however the
dataset was written. A colour scores once, at its strongest applicable pairing.

### The threshold

```text
MIN_VISUAL_SIMILARITY_SCORE = 4
```

Four is one colour that **defines both skins** — the weakest relationship still
worth calling a match. Everything below it is noise dressed as a recommendation:

| Score | What it actually is                                      | Recommended |
| ----- | -------------------------------------------------------- | ----------- |
| 1     | two trim colours meeting                                 | no          |
| 2     | a trim colour against a main one, or a lone shared style | no          |
| 3     | a trim pairing plus a shared style                       | no          |
| 4     | one colour defining both skins                           | yes         |

A black-accented AK and a black-accented glove are not a pairing; they are two
skins that both have some black on them. Calling that "similar" is how a section
teaches people to ignore it.

The constant is shared by **every** visual recommendation — Similar skins,
Matches this skin and the dedicated Knife + Gloves matcher — so the word means
one thing across the product. **Never lower it to fill a grid.** Fewer honest
results beat a full screen of filler, and an empty section is a curation signal,
not a layout problem. Raising the bar from "any overlap" cost 13 of 161 curated
skins their Similar section, and that is the correct trade.

### It is not `visualMatchScore`

`discovery.ts` answers _"how well does this skin fit a query?"_ — a flat list of
selected colours and styles, where anything the visitor did not ask for is
irrelevant. This answers _"how alike are these two skins?"_, where both sides
have structure. One score cannot carry both meanings, so there are two, and
neither is reused for the other's job. Everything **around** the score is shared:
the metadata lookup, the canonical key, the taxonomy, the slot registry.

### The score is internal

It ranks a short list. It is not a calibrated percentage, it is not comparable
between two different source skins, and it is never rendered. No "92% similar",
no "Match score 8". `matchedColors` and `matchedStyles` are kept on the result so
a reason **could** be shown; today nothing renders them, because the section
subtitle already states the relationship and the card is dense enough.

### What does not influence it

- **Price.** A more expensive skin is not more visually similar. Mixing market
  data into an appearance score would produce one opaque number meaning neither.
- **Rarity.** A Covert is not a better visual match than a Mil-Spec. Rarity is
  displayed on the card; it is not evidence.
- **Collection.** Two skins from one case were not designed to match.
- **The name.** `AWP | Atheris` sounds blue and is green. Names are not evidence
  anywhere in this product.

## Similar skins

A candidate must be curated, be in the **same Builder slot**, not be the source,
and score above zero. Limit **4**.

"Same slot" rather than "same base name" is deliberate. For a firearm they are
identical — one slot per weapon — but the Knife slot holds twenty base names and
the Gloves slot holds eight. Someone looking at a Karambit wants to see a
Bayonet, and that falls out of the registry rather than out of parsing names.

## Matches this skin

A candidate must be curated, be in a **different** Builder slot from the source,
and score above zero. Limit **6**.

Filled in two passes:

1. **Breadth.** Walking the ranked list, take the best candidate from each
   distinct slot. One per slot.
2. **Depth.** Only once every slot has had a turn, allow a second from a slot
   already used.

A plain top-six would return six USP-S finishes for a red AK. A pistol, a rifle,
a sniper, a knife and gloves is a more useful answer, and the same-weapon answer
already has its own section above.

Nothing is invented to reach six. Fewer verified matches means fewer cards.

## Curated only, and that is the product model

Recommendations operate on the **verified curated dataset** — 161 records of
1,974 catalog skins today. Nothing is inferred for an uncurated skin, ever.

**A source skin with no visual profile shows neither section.** Not an empty
box, not "we don't understand this skin yet" — the sections simply are not there,
and the rest of the page is unchanged. Apologising for our curation backlog
inside the product would be worse than saying nothing. The service returns
nothing before it even reads the catalog.

The dataset's own exclusions are respected. A phase-dependent finish like a
Doppler is deliberately unclassified because no single colour describes it, and
that means it is neither recommended nor recommended-from. See
`docs/VISUAL_METADATA.md`.

## Determinism

Ranked by score descending, then by canonical slug ascending. Two skins that
score the same must not swap places because the catalog came back in a different
order — repeated loads with unchanged metadata give an identical page.

## Identity and links

A recommendation is a **grouped product-level skin**, identified by its canonical
route slug. Never an item id, a wear, a StatTrak flag or a Souvenir flag.

Cards link to plain `/skins/[slug]` with **no variant in the query**. The
representative variant is carried for the card's image and wear badge only; the
skin page resolves its own default. Forcing this card's exterior into the link
would turn a discovery click into a deliberate variant choice.

## What it costs

- **Zero price requests, zero provider requests, zero history requests.**
- One read of the already-cached catalog index, shared with the rest of the page.
- A scan and a sort over the curated records. No cache of its own, no index, no
  embeddings, no vector store. It is 161 records and a loop.
- Recommendations sit in the skin page's existing `Promise.all`, so they do not
  wait for prices.

## Failing quietly

Recommendations are the least important thing on the page and the most willing
to disappear. The loader catches everything and falls back to empty sections, so
a scoring bug cannot turn a price comparison into a 500.

## No endpoint

There is no `/api/recommendations` and there should not be one. The skin page is
server-rendered, so the sections are in the first response — which is also what a
crawler and a slow connection get.

## Not this phase

- **No interaction.** No like, dislike, "not interested" or save. Wishlist is
  later.
- **No carousel.** A responsive grid is enough, and a carousel dependency for six
  cards would be absurd.
- **No numeric score, still.** The threshold above is a ranking rule, not a
  number anyone reads.

## The Knife + Gloves matcher

`/knife-gloves` is a dedicated version of the same idea, and it reuses
`visualSimilarity` and `MIN_VISUAL_SIMILARITY_SCORE` unchanged — a pair that
matches there matches here, because a second aesthetic score would let the
product disagree with itself.

What it adds is focus and market context. `Matches this skin` spends five of its
six slots on other categories, so a knife gets at most one pair of gloves out of
it; the matcher ranks all twenty-five and prices them. See
[`docs/KNIFE_GLOVES.md`](KNIFE_GLOVES.md).
