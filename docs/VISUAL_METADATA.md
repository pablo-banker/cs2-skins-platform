# Visual metadata

The source of truth for manual visual curation. Read this before adding a
record or touching the taxonomy.

## Why this exists

CS2Cap tells us what a skin **is**: weapon, finish, wear, rarity, collection,
StatTrak, Souvenir, and what it costs. It does not tell us what a skin **looks
like**, because that is a judgement, not a fact in anyone's database.

But looking is how people actually shop. `docs/CONCEPT.md` is full of it:

> um inventário vermelho · uma AK preta · um loadout azul · skins clean

Nothing in the CS2Cap API answers "show me a red AK under R$ 100". The red part
has to come from us. This layer is where that judgement lives.

```text
CS2Cap skin (objective)
        +
local visual metadata (curated)
        ↓
discovery layer
        ↓
Explore · Kits · Smart Loadout · "pairs well with"
```

Static curation **complements** CS2Cap; it never replaces or contradicts it.

## What belongs here

Colours, styles, and — if a concrete need appears — small editorial flags.

## What must never go here

Anything dynamic:

```text
price · bestProvider · quantity · currency · lastUpdated · history · provider
```

Those come from CS2Cap through the market service, and they change by the
minute. A price committed to a JSON file is wrong before the commit lands.
The schema is `.strict()` and a test asserts that a record carrying
`priceMinor`, `bestProvider` or `lastUpdated` is rejected, so this file cannot
quietly grow into a shadow database.

Also out of scope: popularity scores, trend scores, investment scores, AI
scores, community ratings. If we cannot say in one sentence how a number was
derived and why a product screen needs it, it does not go in.

## Taxonomy

The vocabulary is defined once, in `src/lib/types/visual-metadata.ts`, as
`SKIN_COLORS` and `SKIN_STYLES`. The Zod schemas and `visual-taxonomy.json`
are both validated against it — there is no second vocabulary.

### Colours

```text
black   white   gray    silver
red     orange  yellow  gold
green   cyan    blue
purple  pink    brown
multicolor
```

Deliberately coarse. `violet`, `navy`, `crimson` and `lime` are **left out**: a
filter that splits purple from violet makes curation arbitrary and the UI
worse, because nobody browsing for a purple loadout cares which word we chose.

### Styles

```text
clean  minimal  dark    colorful  neon
military  futuristic  cyberpunk  anime  classic
```

Small on purpose. A tag two curators would apply differently is worse than no
tag at all.

**Do not expand either list casually.** Adding a value means every existing
record is now potentially under-classified. Widen only when a product
requirement forces it, and update `visual-taxonomy.json` in the same change.

## Metadata identity

Curation describes a **product-level skin**, not a listing. `AK-47 | Redline`
looks identical Factory New or Battle-Scarred, StatTrak or not — so it gets
**one** record, shared by every variant:

```text
AK-47 | Redline          →  ak-47::redline
├── Minimal Wear         ─┐
├── Field-Tested          │
├── Well-Worn             ├─ all share one visual metadata record
├── Battle-Scarred        │
├── StatTrak™ variants    │
└── Souvenir variants    ─┘
```

The key is built by `visualMetadataKey(weapon, skinName)` in
`src/lib/server/services/visual-metadata.ts`. **Always use that helper** — never
hand-write a key, and never build identity from:

- a CS2Cap `item_id` (that identifies something to buy, not something to look at);
- a wear, StatTrak or Souvenir flag;
- a route slug (a display label, and collision handling for it is still undecided).

Normalisation is deliberately shallow: case and surrounding/repeated whitespace
are levelled because they vary by accident. **Punctuation is preserved**,
because in CS2 it usually carries meaning — `AK-47`, `M4A1-S`, `★ Karambit`,
`Desert Eagle`. Stripping it risks collapsing two genuinely different skins into
one key, which is far worse than a key that looks untidy.

## Primary vs secondary colours

- **Primary** — the colours that define the skin at a glance. A card in a grid
  reads as these.
- **Secondary** — present and worth matching on, but not how anyone would
  describe the skin.

```text
AK-47 | Redline (illustrative — not a committed classification)
primary:   red
secondary: black
```

This is what lets Explore's "red" return genuinely red skins while Smart
Loadout can still build a red-and-black set around a skin with a red accent.
Both are matched by default; `scope: 'primary'` demands the stronger one.

No percentages. "60% red" is a number we cannot assign consistently by eye.

## Files

```text
src/lib/data/
├── visual-taxonomy.json        display labels + ordering (validated against the code vocabulary)
└── skin-visual-metadata.json   the curated records
```

Record shape:

```json
{
	"key": "weapon::skin-name",
	"weapon": "Weapon",
	"skinName": "Skin Name",
	"primaryColors": ["..."],
	"secondaryColors": ["..."],
	"styles": ["..."]
}
```

`weapon` and `skinName` are carried alongside the key so the file stays
readable — a reviewer should be able to read a diff without decoding slugs.

### Current status: a verified starter pool

`skin-visual-metadata.json` holds **161 records**, covering about **8% of the
1,974-skin catalog**. That is not a gap waiting to be closed by automation — it
is how fast a person can look at skins, and the product is built around it.

Coverage is concentrated where it is needed first: the Smart Core slots (see
below). Everything else is uncurated and stays perfectly usable — `visual:
null`, still searchable, still priceable.

**Every record was written after looking at the image.** Names locate a skin;
they never classify it. The classifications in this dataset include several
that a name would have got wrong:

- `AWP | Containment Breach` sounds blue and is green.
- `AWP | Green Energy` and `AK-47 | Wintergreen` are green, but so is
  `Glock-18 | Gamma Doppler`, whose name says nothing about colour.
- `AK-47 | Black Laminate` is not a dark `Blue Laminate`; they are unrelated
  finishes that share a word.
- `Desert Eagle | Ocean Drive` is `multicolor`, not blue.

Some skins are deliberately **left out** because one classification would be
wrong for them: `Doppler`, `Gamma Doppler` on knives where the phase changes
the colour entirely, `Case Hardened` and `Marble Fade`, whose pattern decides
what they look like. A per-skin record cannot describe a per-item property.

Unit tests use fictional fixtures (`Test Weapon | Alpha`) rather than putting
guesses into production data.

## The curation workspace

`/dev/visual-metadata` — a development-only tool for looking at skins and
writing down what they look like. It 404s outside development, is not linked
from anywhere, and the endpoints behind it refuse before reading a request.

```text
GET  /api/dev/visual-metadata    catalog + existing classification, filtered
POST /api/dev/visual-metadata    write one reviewed record
GET  /api/dev/visual-coverage    coverage and Smart Core diagnostics
```

All three read the **cached catalog index** — the same one Explore browses — so
curating costs no upstream catalog fetch of its own and **no market request at
all**. No prices, no providers, no history.

The workspace shows one skin at a time: its real image, its canonical key, and
colour and style chips. It supports filtering by weapon, by curated status and
by finish name, plus a **Next uncurated** walk so a session does not mean
scrolling a list of 1,974. Unsaved edits prompt before moving on.

**It classifies nothing.** There is no suggestion, no dominant-colour
extraction, no inference from the name. Every value is chosen by a person
looking at the image beside it, and `POST` validates with exactly the
production schema — curation cannot write a record the application would then
refuse to load.

There is no production write path. Curation happens at a workstation with the
repository in front of you, and the result is a reviewable diff.

## Smart Core

Smart Loadout will generate a small core rather than all 37 builder slots
(`src/lib/config/smart-loadout.ts`):

| Entry               | Slots              | Curated candidates |
| ------------------- | ------------------ | ------------------ |
| Knife _(optional)_  | knife              | 31                 |
| Gloves _(optional)_ | gloves             | 25                 |
| Glock-18            | glock-18           | 14                 |
| AK-47               | ak-47              | 20                 |
| CT pistol           | usp-s **or** p2000 | 14                 |
| CT rifle            | m4a1-s **or** m4a4 | 27                 |
| Desert Eagle        | desert-eagle       | 14                 |
| AWP                 | awp                | 16                 |

`USP-S`/`P2000` and `M4A1-S`/`M4A4` are **alternatives inside one entry**, not
two slots: a player carries one of each pair, and requiring both would generate
a loadout nobody could use. Knife and gloves are optional because they can cost
more than every gun combined.

Curated candidates by primary colour: black 56, green 30, white 28, blue 26,
red 24, purple 19, gray 17, cyan 12, gold 11, orange 10, pink 10, brown 6,
yellow 6, silver 3, multicolor 2.

Styles, used conservatively: dark 27, minimal 22, military 19, clean 13,
colorful 10, classic 7, neon 6, futuristic 5. A skin does not get a style tag
merely for having colours — when a style is ambiguous, it is left off.

### Partial coverage is the product model

Smart Loadout generates from the **curated candidate pool**, not the catalog.
With 8% coverage that is an explicit limitation, not an oversight: a generator
that could reach an uncurated skin could not honour a colour preference,
because there would be nothing to match on.

`getCuratedCandidates` (`src/lib/server/services/smart-candidates.ts`) is the
pool, and it drops uncurated skins in exactly one place so everything
downstream can assume a candidate has a visual profile. It reuses
`filterByVisual` and `rankByVisualMatch` rather than scoring again — a second
opinion on what "matches red" means would surface as two screens disagreeing
about the same skin.

Coverage is reported honestly by
`visualMetadataCoverage` and `smartCoreCoverage`
(`src/lib/features/visual/coverage.ts`). Overall coverage is the number against
the **whole** catalog; the number that actually gates Phase 14 is candidates
per core slot, because a slot with two curated skins would make every generated
loadout look the same.

## Curation workflow

1. Identify the **product-level** skin (weapon + finish, ignore wear/StatTrak).
2. **Look at its image.** Not its name.
3. Assign 1–3 primary colours — the ones that define it at a glance.
4. Assign secondary colours if genuinely present and worth matching.
5. Assign only styles that clearly apply. When in doubt, leave it off.
6. Generate the key with `visualMetadataKey`; add the record to
   `skin-visual-metadata.json`.
7. Run `pnpm test:unit` — validation catches bad values, duplicates and drift.
8. If the taxonomy changed, update `visual-taxonomy.json` and the tests too.

## Validation

Hand-written data has no API contract protecting it, only review — which makes
it the least trustworthy data in the project. It is parsed as strictly as an
external payload:

- key is lowercase, well-formed `weapon::name`, no stray whitespace;
- colours and styles come from the controlled vocabulary;
- no repeated value within a list;
- no colour listed as both primary and secondary;
- `weapon` and `skinName` are non-empty;
- a record classifies **something** — at least one primary colour or one style;
- unknown fields are rejected (`.strict()`);
- **duplicate keys fail loudly, by name.** Silently keeping the first or last
  would mean the dataset says one thing and the product does another;
- the taxonomy file covers the code vocabulary exactly — no missing entry, no
  extra, no duplicate.

## Relationship with CS2Cap

The two layers filter different things and must not be confused:

| Filter                                               | Handled by                     |
| ---------------------------------------------------- | ------------------------------ |
| weapon, wear, rarity, collection, StatTrak, Souvenir | CS2Cap (`/items` query params) |
| colour, style                                        | local visual metadata          |

Objective filters narrow upstream, where the catalog lives. Visual filters
narrow locally, after enrichment. **Never send a `color` or `style` parameter
to CS2Cap** — it has no such concept, and pretending otherwise would put our
judgement in someone else's API.

## Using it

Everything goes through the discovery service
(`src/lib/server/services/discovery.ts`). Product code never imports the JSON.

```text
enrichSkin / enrichSkins      attach curation to catalog skins
filterByColors                any/all, primary-only or primary+secondary
filterByStyles                any/all
filterByVisual                colours AND styles together
visualMatchScore              primary colour 3 · style 2 · secondary colour 1
rankByVisualMatch             best match first, ties keep incoming order
```

Two rules the whole layer rests on:

- **An uncurated skin is still a skin.** It gets `visual: null`, stays in every
  result, and only disappears when a visual filter is actually applied. The
  catalog must not shrink as a side effect of our curation backlog.
- **Discovery never fetches.** No prices, no providers, no network — filtering
  has to stay cheap enough to run over a whole page of results.

`visualMatchScore` is a sorting aid with three documented weights. It is **not**
the Smart Loadout algorithm, which has to weigh budget, weapon coverage and
user priorities.

## Skin-to-skin similarity

`visualMatchScore` answers _"how well does this skin fit a query?"_. A skin page
asks a different question — _"how alike are these two skins?"_ — and that has its
own function, `visualSimilarity` in
`src/lib/features/recommendations/visual-similarity.ts`. Full detail in
[`docs/RECOMMENDATIONS.md`](RECOMMENDATIONS.md).

The difference is structural. A query is a flat list of selected colours, so
anything the visitor did not ask for is irrelevant. Two skins both have primary
and secondary colours, so a colour that **defines both** is much stronger
evidence than two skins sharing a trim colour:

| Pairing                                | Weight |
| -------------------------------------- | ------ |
| source primary ↔ candidate primary     | 4      |
| source primary ↔ candidate secondary   | 2      |
| source secondary ↔ candidate primary   | 2      |
| shared style                           | 2      |
| source secondary ↔ candidate secondary | 1      |

One score cannot carry both meanings, so there are two. Everything **around**
them is shared and must not be duplicated: `visualMetadataKey`, the metadata
lookup, the taxonomy and its validation, and the Builder slot registry.

Three rules this places on the dataset:

- **Recommendations are curated-only.** Nothing is inferred for an unclassified
  skin, and a skin with no profile shows no recommendations at all rather than a
  guessed set. Coverage is the ceiling on the feature, exactly as it is for Smart
  Loadout.
- **The score is internal.** It ranks a short list. It is not a percentage, it is
  not comparable across source skins, and it is never shown to anyone.
- **Price, rarity and collection are not visual evidence.** A Covert is not a
  better colour match than a Mil-Spec, and two skins from one case were not
  designed to go together.

The deliberate exclusions here are load-bearing downstream: a phase-dependent
finish left unclassified because no single colour describes it is thereby also
never recommended, and never recommended from. That is the dataset doing its job,
not a gap.

## Automated classification

Out of scope, and a separate explicit decision if we ever want it. No image
downloads, no dominant-colour extraction, no computer vision, no external AI
APIs, no image-processing dependencies.
