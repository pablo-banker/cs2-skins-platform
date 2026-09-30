# Smart Loadout

`/smart-loadout` takes a budget and a visual direction and returns a real
loadout: specific skins, at specific exteriors, at current marketplace prices,
inside the budget — editable in the builder afterwards.

The builder is for people who know what they want. This is for people who know
how they want it to look.

## The pipeline

```text
preferences (budget, colour, style, knife?, gloves?)
        ↓  curated visual dataset, no I/O
   bounded shortlist — at most 6 candidates per entry
        ↓  one exact variant per candidate skin
   ONE multi-item price request (≤ 48 item ids)
        ↓  cheapest usable quote per candidate
   Pareto budget optimiser
        ↓
   generated loadout  →  Open in Builder (ordinary share link)
```

The shape of that pipeline is the point. **Everything visual happens before
anything is priced**, so a generation costs a few dozen price lookups rather
than one per curated skin — and the shortlist is bounded by a constant the
server owns, not by anything a caller can ask for.

## Where the code lives

| File                                          | Owns                                       |
| --------------------------------------------- | ------------------------------------------ |
| `src/lib/config/smart-loadout.ts`             | the Smart Core: which entries exist        |
| `src/lib/types/smart-loadout.ts`              | preferences, candidates, result, failures  |
| `src/lib/schemas/smart-loadout.ts`            | request validation, `parseBudgetMinor`     |
| `src/lib/features/smart-loadout/variant.ts`   | which exterior a candidate is priced at    |
| `src/lib/features/smart-loadout/optimizer.ts` | the budget decision, pure and testable     |
| `src/lib/server/services/smart-candidates.ts` | curated, slot-compatible candidates        |
| `src/lib/server/services/smart-loadout.ts`    | the pipeline: shortlist → price → optimise |
| `src/routes/api/smart-loadout/generate`       | the endpoint the browser presses           |
| `src/routes/smart-loadout`                    | the form and the result                    |
| `src/lib/components/smart-loadout/`           | `SmartLoadoutItem`, one line of a result   |

## The core

Deliberately small:

| Entry        | Slots              | Required |
| ------------ | ------------------ | -------- |
| Knife        | knife              | optional |
| Gloves       | gloves             | optional |
| Glock-18     | glock-18           | yes      |
| AK-47        | ak-47              | yes      |
| CT pistol    | usp-s **or** p2000 | yes      |
| CT rifle     | m4a1-s **or** m4a4 | yes      |
| Desert Eagle | desert-eagle       | yes      |
| AWP          | awp                | yes      |

**Not the builder's 37 slots.** Someone asking for a generated loadout wants a
few pieces they will actually carry, not a mandatory inventory of every gun in
the game — and every extra slot is another skin that has to be curated, priced
and justified.

### Alternatives, not duplicates

`USP-S`/`P2000` and `M4A1-S`/`M4A4` are alternatives **within one entry**. A
player carries one of each pair; representing them as separate required slots
would generate a loadout nobody could use. The generator picks one, and both
alternatives compete on visual match before price — so a USP-S that matches the
colour and the style beats a P2000 that only matches the colour.

An entry with zero curated candidates in one alternative is still satisfiable
through the other. The P2000 has no curated skins today and the CT pistol entry
works anyway.

### Knife and gloves are optional

They can cost more than every gun combined, so a generator that always included
them would answer a budget question nobody asked. They are checkboxes, and when
unchecked they are **not generated and discarded — they are never priced**.

The loader reports which colours have no curated knife or gloves
(`colorsWithoutKnife`, `colorsWithoutGloves`), so the form can warn before a
generation is spent finding out.

## Preferences, not filters

A colour, a style, or both. At least one is required: without a visual
direction this would be a cheapest-loadout generator, and that would quietly
become the product's main path.

**Colour is never relaxed.** When both are asked for, skins matching both come
first; an entry with no exact match falls back to skins matching the colour
alone — never to a different colour. A "red loadout" containing a blue rifle is
not a partial match, it is a wrong answer. When any entry falls back, the
result says so (`partialStyleMatch`).

With only a style asked for, every candidate must carry that style. There is
nothing weaker to fall back to.

Matching reuses the discovery primitives (`filterByVisual`, `visualMatchScore`,
`rankByVisualMatch`). There is no second scoring system, and discovery does no
I/O.

### Availability

`getSmartAvailability()` computes which colours and styles can currently fill
**every required entry**, and the form offers only those. An option that cannot
possibly work is never presented. It makes no market request.

Style viability is judged on its own, not per colour pair: style tags are
deliberately sparse, and a combination that turns out impossible is caught at
generation with an explanation rather than by removing options combinatorially.

## The candidate pool

Smart Loadout generates from **curated skins only** (`getCuratedCandidates`),
never from the whole catalog. A generator that could reach an uncurated skin
could not honour a colour preference, because there would be nothing to match
on.

```text
catalog (1,974 skins)
        +
verified visual metadata (161 records, ~8%)
        ↓
curated candidate pool
        ↓
Smart Loadout
```

**This is a deliberate product model, not a temporary state.** Curation is
limited by how many skins a person can look at, and the answer is not to
automate the judgement. See `docs/VISUAL_METADATA.md`.

## Which exterior gets priced

`pickSmartVariant` — one variant per candidate skin, chosen before pricing:

1. **Normal edition only.** StatTrak and Souvenir are choices someone makes on
   purpose, not something a generator should spend a budget on. A skin with no
   normal variant has no Smart variant.
2. **Wear preference**: Field-Tested → Minimal Wear → Well-Worn → Factory New →
   Battle-Scarred. Field-Tested first because it is the usual value-for-money
   exterior, not because it is the cheapest in every case.
3. Ties break on `itemId`, so the choice is deterministic.

Pricing every exterior of every candidate would multiply the request by five
for a decision the generator makes anyway.

## The budget

`optimizeLoadout(pools, budgetMinor)` in `features/smart-loadout/optimizer.ts`.
Pure: pools in, picks out, no I/O, no catalog, no config.

It maximises total visual score subject to the budget, and **among equally good
loadouts it spends the least** — the budget is a ceiling, not a target.

A greedy pass fails here: taking the best rifle can leave nothing for the
pistol. The optimiser is an exact dynamic program over a **Pareto frontier** of
`(cost, score)` states, pruned after each entry by dropping any state that
costs more than another without scoring better. The frontier is bounded by the
number of distinct visual scores (about forty), not by the budget in cents, so
a R$ 10.000.000 budget costs the same as a R$ 100 one.

Exactness is verified against exhaustive enumeration over 220 randomised
fixtures, including tight budgets where pruning is most likely to be wrong.

Failures are separated because they need different answers:

| Reason                    | Means                                        |
| ------------------------- | -------------------------------------------- |
| `no-visual-candidates`    | our curation backlog                         |
| `no-priceable-candidates` | an entry has no current price                |
| `budget-too-low`          | the visitor's to decide, with a real minimum |
| `market-unavailable`      | the market, not us                           |

`budget-too-low` carries `minimumMinor` — the cheapest complete loadout from
the shortlist that was actually priced. An honest figure, not an estimate.

## Prices

- **One multi-item request per generation**, through `getManySkinPrices` and
  the existing five-minute price cache. Never one per candidate.
- At most `SMART_CANDIDATES_PER_ENTRY × SMART_CORE.length` = **48** item ids,
  enforced by a throw rather than a comment. A regression that widened the
  shortlist is caught there rather than on the quota bill.
- A quote is a **lowest ask**. Stale and non-positive quotes are excluded.
- The Steam comparison is free: the quote sets are already loaded, so it costs
  no further request. It is all-or-nothing — absent unless Steam covers every
  chosen item.
- **No polling and no refresh button.** Upstream moves every few minutes and
  the price cache is five.
- No offer button per item. Batch pricing carries no tracked redirect, and a
  button that appeared or vanished with deployment configuration would be worse
  than none. Marketplace comparison lives on the skin page.

## The request contract

The browser sends **preferences and nothing else**:

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
`.strict()`: an unknown field is a 400.

It is a `POST` someone presses. A generation prices a few dozen candidates, so
it happens when a person asks for it and never as a side effect of typing.

A generation that cannot produce a loadout still answers **200** with a reason.
Only a broken catalog or a tripped guard is a 503, and its body says nothing
about the upstream.

### Money in, money out

`parseBudgetMinor` reads what a person types into exact minor units by moving
the separator, never by multiplying by 100. `R$ 1.234,56` → `123456`. The last
separator with one or two trailing digits is the decimal mark; everything else
is grouping, so `2.000` is two thousand reais. It is deliberately forgiving
about mixed separators, because the amount it arrived at is formatted straight
back beside the result.

## Handing over to the builder

"Open in Builder" is an **ordinary share link** — the same v1 codec `/build`
already reads. Nothing new was added for this.

That means a generated loadout arrives as a _shared_ loadout: shown, not
adopted, and the visitor's own saved loadout is untouched until they edit it.
It also means the link is canonical — the same generated set always produces
the same URL, because the codec orders selections by registry.

## What Smart Loadout is not

- **Not a wishlist, and not persistence.** A generation lives in the page. The
  builder is where something is kept.
- **No float UI.** Wear is the variant dimension; float stays out.
- **No second ranking algorithm, no fuzzy search dependency, no CV, no LLM
  tagging.** Colours and styles come from people looking at images.
- **Not optimal across the whole catalog.** It is optimal within the shortlist
  it priced, which is the top of the visual ranking. Raising the shortlist size
  raises quota use linearly for a shrinking improvement.
