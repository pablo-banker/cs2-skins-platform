# Loadout builder

`/build`. Read this before changing slots, selection identity or how pricing is
triggered.

## What it is

A place to choose a skin for each weapon you care about and see what the set
costs at current marketplace prices. PCPartPicker for a CS2 inventory: pick the
parts, see the bill.

```text
slot registry (product-owned)
        ↓
picker  ──  GET /api/build/skins  ──  cached catalog index
        ↓
selections (slot + slug + variant, session-only)
        ↓
Check current prices  ──  POST /api/build/prices
        ↓
server resolves + validates every selection
        ↓
getManySkinPrices  ──  batch or bounded individual
        ↓
lowest current total  ·  Steam comparison
```

## Slots

**The registry is product configuration, not catalog discovery.**
`src/lib/config/loadout.ts` lists every slot explicitly. If CS2Cap starts
reporting a base name nobody has seen, that must not silently grow a new
section on `/build` — someone looks at it and edits the file. A test checks the
registry against catalog fixtures so the two drift apart loudly.

37 slots in six categories:

| Category  | Slots                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Equipment | Knife, Gloves, Zeus x27                                                                              |
| Pistols   | Glock-18, USP-S, P2000, P250, Five-SeveN, Tec-9, CZ75-Auto, Dual Berettas, Desert Eagle, R8 Revolver |
| SMGs      | MAC-10, MP9, MP7, MP5-SD, UMP-45, P90, PP-Bizon                                                      |
| Rifles    | AK-47, M4A4, M4A1-S, Galil AR, FAMAS, SG 553, AUG                                                    |
| Snipers   | AWP, SSG 08, SCAR-20, G3SG1                                                                          |
| Heavy     | Nova, XM1014, MAG-7, Sawed-Off, M249, Negev                                                          |

**Knife and Gloves are one slot each**, not one per type. Nobody equips a
Karambit _and_ a Bayonet, and twenty knife slots would be a wall of empty
boxes; the picker browses the whole family inside the one slot.

The **Zeus** is here because it is genuinely skinnable — seven finishes — and
someone building a complete inventory would notice its absence.

### Matching

Each slot says how it recognises a compatible skin:

- **`weapon`** — one base name, matched **exactly**. `MP5-SD` can never pull in
  an `MP5` lookalike, and a future `AK-47 Prototype` would not land in the
  AK-47 slot.
- **`subtype`** — a catalog grouping (`Knives`, `Gloves`), read from
  `Skin.itemSubtype`. This is the only normalized field that separates knives
  and gloves from firearms: `weaponType` calls gloves `Wearable` and gives the
  Zeus nothing at all. Matching on the name would mean guessing that "Hand
  Wraps" are gloves.

Verified against the live catalog on 2026-09-22: 21,524 weapon entries group
into 1,974 skins, and **every one reaches exactly one slot** — nothing
uncovered, nothing in two places.

| Slot          | Skins                      |
| ------------- | -------------------------- |
| Knife         | 428 (including 20 vanilla) |
| Gloves        | 94                         |
| Zeus x27      | 7                          |
| every firearm | 24–61 each                 |

## Selection identity

```ts
{ slotId, skinSlug, variant: { wear?, edition?, phase? } }
```

**Never a catalog item id.** An item id identifies one row in someone else's
database: a loadout saved today would break when that database is renumbered,
and a shared link would carry an upstream identifier as its public contract.
The id is derived server-side at the moment of pricing and thrown away.

The variant is the same vocabulary a skin URL uses, resolved by the same
`resolveVariant`. A builder selection is an **exact** choice, so the server
rejects a wear or phase the skin does not have rather than substituting one —
the same promise editorial kits make.

## Persistence

One loadout, kept in this browser. There is no account and no server-side
store, so "saved" means saved on this device — which is what the summary says.

State is created per page by `createLoadoutBuilder()` — a factory, not a
module-level store. A global builder would mean a second `/build` tab shared
state with the first.

### What is stored

```jsonc
// localStorage["cs2-skins:builder:v1"]
{
	"version": 1,
	"selections": [
		{ "slotId": "ak-47", "skinSlug": "ak-47-redline", "variant": { "wear": "Field-Tested" } }
	]
}
```

**Canonical application identity and nothing else.** No catalog item id, no
market hash name, no price, no provider, no image URL, no rarity. Two reasons,
and both matter:

- Anything from upstream would tie a saved loadout to someone else's
  numbering, so a renumbering there would break every save at once.
- Anything from the market would be stale the moment it was written, and a
  stale price restored as if it were current is worse than no price.

Everything else is re-resolved against the catalog on the way back in.

The key is namespaced and versioned (`cs2-skins:builder:v1`), written once in
`src/lib/schemas/loadout-persistence.ts`. `version` is **checked, not assumed**:
a payload from a future build is discarded rather than read as v1.

**An empty loadout is stored as no key at all**, not as `{"selections": []}`.
The two read back identically, and leaving a record behind for a builder
someone emptied is untidier on their machine for no gain.

### Restoration lifecycle

```text
SSR (registry only)
        ↓
client hydration
        ↓
read localStorage         nothing saved → start empty, no request
        ↓
POST /api/build/resolve   catalog only, no prices
        ↓
hydrate(selections)       one transition, not 37 selects
        ↓
automatic saving begins
```

**Nothing is written until restoration resolves.** The builder starts empty and
the save arrives a moment later; writing in that window would overwrite a
loadout someone spent ten minutes on with nothing at all. The gate is
`builder.persistable`, which withholds everything while `hydration` is
`restoring` — so no caller has to remember the rule — and a regression test
pins it shut.

Editing is also blocked from pricing during that window, so a selection made
mid-restore cannot be overwritten by an older loadout landing on top of it.

The summary shows `Restoring your loadout…` rather than `0 / 37`, so a restored
count never jumps into place a moment after a wrong one.

If the **catalog is unreachable**, the builder works for the session and the
save is deliberately left alone: an outage is no reason to take someone's
loadout away. Saving resumes on their first deliberate edit.

### Tolerant recovery

Pricing is strict; restoring is not. A loadout assembled months ago may name a
skin a game update retired, and throwing the whole thing away over one entry
would punish someone for a change they had no part in.

Both paths share `resolveOne`, so they can never disagree about what is valid —
they differ only in what they do about an invalid selection:

|                   | Pricing                          | Restoring                         |
| ----------------- | -------------------------------- | --------------------------------- |
| One bad selection | whole request rejected (`400`)   | that one rejected, rest restored  |
| Reported as       | a thrown `LoadoutSelectionError` | `rejected: [{ slotId?, reason }]` |

Reason codes are safe to send to a browser: `unknown-slot`, `unknown-skin`,
`incompatible`, `invalid-variant`, `duplicate-slot`.

Rejections are **said, not swallowed**:

> Your loadout was restored, but 1 saved selection is no longer available.

**An invalid exact variant is rejected, never substituted.** The exact-selection
promise holds for a loadout restored a year later, exactly as it does for an
editorial kit.

## Sharing

`/build?loadout=<payload>` — the link carries the loadout itself. No share
database, no share id, nothing to expire, and nobody has to reason about who
owns a row.

### Format

```text
v1.<base64url(JSON tuples)>
```

Each selection is a tuple — `[slotId, skinSlug, wear, edition, phase]` — with
trailing empty values dropped. A tuple rather than an object because the field
names would otherwise repeat 37 times for no benefit.

**Versioned.** A payload whose prefix we do not recognise is rejected outright
rather than parsed hopefully; silently reinterpreting someone's link is how a
loadout turns into a different loadout.

**Deterministic.** Selections are canonicalised into registry order before
encoding, so the same choices always produce the same link however they were
clicked — two people who built the same loadout get the same URL, and a link
does not churn because someone re-picked a slot.

**Unicode-safe.** `TextEncoder`/`TextDecoder` rather than `btoa` on a raw
string, so a phase label outside ASCII round-trips intact.

Measured, not guessed:

| Loadout                                                                      | Payload | Full URL | Guard used |
| ---------------------------------------------------------------------------- | ------- | -------- | ---------- |
| 37 slots, typical slugs                                                      | 2,789   | 2,832    | 34%        |
| 37 slots, longest real slug in every slot, StatTrak, Battle-Scarred, a phase | 4,070   | 4,113    | 50%        |

The guard is `MAX_SHARE_PAYLOAD = 8192`, applied on the way **in and out**: a
link we would not accept is a link we must not produce. If encoding would
exceed it the button says `This loadout is too large to share.` rather than
handing out a URL that cannot survive a round trip.

### Copying

`Share loadout` builds an absolute URL from the running origin — no hardcoded
host — and writes it to the clipboard. The button becomes `Link copied` for a
moment; there is no toast primitive in this project and adding one for this
would not earn its keep.

**The address bar is not touched.** Sharing does not navigate, and the
visitor's own builder stays at `/build`.

If the clipboard is unavailable or refuses, a selectable field appears with the
link in it. It is **not** shown by default: the payload is thousands of
characters and a permanent wall of base64 in the sidebar helps nobody.

### Opening a shared link

Decoded and resolved in `+page.server.ts`, during SSR, so the first render is
already the shared loadout — no blank builder filling in a moment later, and no
trusting a stranger's query parameter on the client. The codec returns what the
link said; **the server decides whether it describes anything real.**

A malformed, unsupported, oversized or entirely stale payload renders the
normal empty builder with one calm line:

> This shared loadout could not be loaded.

Never a 500, and never a decoder detail on screen.

### Shared takes precedence, but does not take over

Following a link is a deliberate navigation to someone else's loadout, so it is
what gets **displayed** — the visitor's own save is not even read.

But it is **not adopted**. Viewing a shared loadout does not write to storage,
does not touch the URL, does not calculate prices and does not disturb whatever
the visitor had saved. The summary marks it `Shared loadout`.

**Editing adopts it.** Adding, replacing, removing or clearing is a decision to
make the loadout theirs: from that moment it saves like any other, the badge
goes, and the now-misleading `?loadout=` is dropped from the address bar with
`replaceState` — other query parameters are left alone. The original link is
never rewritten; someone else's link is not ours to change.

### Clearing

`Clear loadout` empties the builder **and** removes the save. It counts as
adoption: clearing a shared preview leaves an empty, active, persisted builder
rather than restoring whatever was saved before. That is a deliberate choice —
after clearing, what is on screen is what is saved, with no hidden state
waiting to reappear on the next reload.

### Prices are never stored or shared

After a reload, a restore or a shared link, pricing starts at **not
calculated** — whatever was on screen last time is someone else's number by
now. Checking prices does not rewrite storage either: the selections did not
change, so there is nothing new to save.

## Pricing is explicit

**Nothing is priced until the visitor presses `Check current prices`.** A
loadout can hold dozens of skins; pricing after every click would spend a
metered quota on a loadout nobody had finished building. The button is disabled
with nothing selected, and while a request is in flight.

### Staleness

After any edit the previous answer stops being displayed:

```text
current fingerprint !== priced fingerprint  →  stale
```

Compared by **fingerprint**, not cleared from each code path that edits a
loadout, so a future edit path cannot forget. `loadoutFingerprint` is pure,
deterministic and independent of the order slots were filled — the registry
defines canonical order — so reordering never invalidates a good calculation.

An old total beside a changed loadout is not out of date, it is wrong, and it
looks exactly like a correct one.

### Server-side validation

The endpoint trusts nothing. Before a single request is spent, every selection
must have a known slot, a known skin, a skin the slot accepts, and a variant
that exists exactly — with no slot appearing twice and no more selections than
there are slots. Anything else is a `400`, whole. **Bad entries are never
silently dropped**: half-answering gives a total for a loadout nobody built.

The error message stays generic. The detail is about our catalog, not the
caller's request.

## Totals

**A total requires every selected item to have a usable quote.** One missing
price and the page says `Total unavailable` and how many items are short, while
the items that did price still show theirs. Same integrity rule as kits: a
figure assembled from four of five looks exactly like one assembled from five.

**Empty slots do not make a total incomplete.** The builder's total means _what
the selected skins cost_, not _what filling all 37 slots would cost_, and the
copy says so:

> Totals use current lowest listed prices for the skins you have selected — not
> for every slot.

Per item there are three states, kept apart for the usual reason — one is a
fact about the market, the other about us:

| State     | Copy                            |
| --------- | ------------------------------- |
| priced    | the price and its marketplace   |
| no quotes | `No current prices`             |
| error     | `Price temporarily unavailable` |

### Steam

Reuses `$lib/features/prices/steam` — the same all-or-nothing rule kits use,
identified by the provider key `steam`, never a display name. Shown only when
every **selected** item has a usable Steam quote; filling every slot is not
required.

## No purchase optimization

The builder shows a lowest-current-price total and nothing else. It does **not**
show marketplace groups, a fewest-marketplaces plan or provider subtotals.

Phase 10's fewest-marketplaces algorithm is exact over item subsets and is
explicitly sized for `N <= 8`; a full loadout can hold 37. Generalising it would
mean either an exponential search or a heuristic that quietly gives wrong
answers. Large-loadout purchase optimization is its own design problem.

There are also no per-slot offer links. Batch pricing carries no redirect URL,
so an offer button would appear or vanish depending on deployment
configuration. Marketplace comparison and offers live on the skin page, which
every selected slot links to at its exact variant.

## Request discipline

| Action                            | Upstream cost                                                    |
| --------------------------------- | ---------------------------------------------------------------- |
| Opening `/build`                  | none — the registry is static config                             |
| Opening a slot, searching, paging | none — the cached catalog index                                  |
| `Check current prices`            | one multi-item price request, plus the cached provider directory |

The catalog **never ships wholesale to the browser**. A slot returns one page of
20 options; the knife slot has 428 skins and the browser sees 20 of them.

Batch pricing (`CS2CAP_BATCH_PRICES_ENABLED`) makes a large loadout one request
instead of one per item, which matters more here than anywhere else in the
product. The builder works either way and says nothing about plans in the UI.

## Files

```text
src/lib/config/loadout.ts              the registry and its matchers
src/lib/schemas/loadout-persistence.ts storage key, v1 schema, resolve request
src/lib/features/loadout/persistence.ts localStorage, total and SSR-safe
src/lib/features/loadout/share.ts      the versioned share codec
src/lib/types/loadout.ts               domain types
src/lib/schemas/loadout.ts             endpoint validation
src/lib/features/loadout/selection.ts  selections and the fingerprint (pure)
src/lib/features/loadout/picker.ts     slot-scoped option pages (pure)
src/lib/features/loadout/builder.svelte.ts   per-page session state
src/lib/server/services/loadout.ts     search, resolve, price
src/routes/api/build/skins/+server.ts  GET  — picker options
src/routes/api/build/prices/+server.ts POST — current prices
src/routes/api/build/resolve/+server.ts POST — catalog data for saved/shared selections
src/routes/build/                      the page
src/lib/components/loadout/            slots, picker, summary
```

## Not in this phase

Cloud saves, accounts, authentication, community, public profiles, named or
multiple loadouts, wishlist, Smart Loadout, recommendations, social previews,
analytics.
