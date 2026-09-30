# Wishlist

Skins someone might buy later, kept on their own device, shown with current
lowest marketplace prices and how those compare with the moment they saved them.

```text
Skin Details → save exact variant → localStorage v1
                                          ↓
                              /wishlist hydrates
                                          ↓
                         POST /api/wishlist/resolve
                                          ↓
              catalog exact-variant resolution + one price request
```

## What it is not

A **wishlist**, not a portfolio. Nothing here is a profit, a loss, a return, an
ROI or a percentage, and no total is calculated across the list. Price movement
is written from a buyer's point of view — lower is good news, higher is a reason
to wait:

```text
R$ 24,50 lower since added
R$ 18,20 higher since added
No change since added
```

It is also not a price-alert service. There is no account, nothing running in
the background, and therefore nothing that could notify anyone. Wishlist is
passive by construction.

## Local only

```text
cs2-skins:wishlist:v1
```

One namespaced, versioned key, separate from the builder's. There is no
database, no account and no sync; the page says **"Saved on this device."**
rather than implying otherwise, and the server rendering `/wishlist` has never
seen the list — no item name or price appears in its metadata.

`localStorage` is treated as a convenience, exactly as builder persistence is.
Absent, disabled, full, corrupt, or written by a future version: every one of
those reads back as an empty list, and a browser that refuses to store anything
still gets a working page for the session.

## Exact-variant identity

```ts
{ skinSlug, variant: { wear?, edition?, phase? } }
```

A **grouped skin may appear more than once**. Field-Tested and Minimal Wear
Redline are two different purchases at two different prices, so they are two
entries with two independent baselines. `wishlistItemKey()` is the one helper
that decides sameness — used for deduplication, for membership on the skin page,
for removal and for joining the server's answer back on. Four hand-rolled keys
is how a "remove" button ends up removing nothing.

`normal` and an unstated edition collapse to the same key: a link that spells
out the plain edition must not create a second entry.

Never persisted: `itemId`, `marketHashName`, a provider, or a current price.
The schema is strict, so any of those appearing would fail to parse.

## The price snapshot

This is the one place the product stores a price, and it is deliberate. A
wishlist exists to answer _"has this got cheaper since I saved it?"_, which
needs a baseline.

It is safe because it is a **historical snapshot, not a cached current price**.
A builder total restored from storage would be a stale number pretending to be
live; "R$ 153,00 when I saved this" stays true forever. It is labelled
`Saved at …` wherever it appears and is never used as market data.

Rules:

- Taken from the **best current quote** at the moment of saving, with its
  currency. The two travel together or not at all.
- **Absent is fine.** A skin nobody is currently listing is still savable —
  refusing the save because the market is quiet would be the wrong failure.
- **Immutable.** Opening `/wishlist` never rewrites it, and neither does
  pressing the save control again on something already saved. The only way to
  re-establish a baseline is to remove the item and add it again, which is
  something a person chose to do.

## Restoring

`/wishlist` renders a shell on the server and restores in the browser:

| Phase       | What it shows                            |
| ----------- | ---------------------------------------- |
| `restoring` | "Loading your wishlist…"                 |
| `ready`     | The cards, or the empty state            |
| `failed`    | A message, with the saved list untouched |

The restoring phase exists so the empty state never flashes. "Your wishlist is
empty" appearing for 200ms in front of someone with forty saved skins is a lie
the page tells about itself.

## The resolve endpoint

```text
POST /api/wishlist/resolve
{ "items": [{ "skinSlug": "ak-47-redline", "variant": { "wear": "Field-Tested" } }] }
```

**Identities only.** The snapshot and the timestamp stay in the browser: the
server has no use for them, and a payload carrying them would invite it to start
trusting numbers a client wrote. The schema is `.strict()`, duplicates are
rejected, and the list is capped.

The response is a narrow presentation contract — one current lowest ask per
item, not every marketplace. Full comparison is the skin page's job.

## Catalog evolution

A wishlist can be a year old. Resolution is **tolerant**, like builder
restoration: each entry is judged on its own, and the failures come back listed
rather than thrown.

| Reason            | Means                                   |
| ----------------- | --------------------------------------- |
| `unknown-skin`    | the skin is no longer in the catalog    |
| `invalid-variant` | that exterior, edition or phase is gone |

Rejected entries are **pruned from storage only after a successful response** —
pruning on a failed request would delete someone's wishlist because the network
blinked — and the page says how many went, including when that leaves it empty.

Nothing is ever substituted with a nearby exterior. An exact variant is a
promise, the same one the builder and editorial kits make.

## Prices

- **Loaded automatically, once per visit.** Seeing current prices is the point
  of opening the page, so there is no "Check prices" button.
- **One multi-item request** for the whole list, through the existing service.
  Never one per card.
- **No polling and no refresh control.** Upstream moves every few minutes and
  the price cache is five.
- **No history, ever.** Thirty candles per item for fifty items would be fifty
  metered requests to draw charts nobody asked for.
- Three price states are kept apart: **priced**, **nothing currently listed**,
  and **could not ask**. A visitor deserves to know which happened.
- Removing a card filters locally. The other items' prices are still the prices
  we were just given; re-pricing them would be a request bought for nothing.

## Price movement

```text
delta = current - baseline
```

Integer minor units, no floats, no percentages. Shown only when a baseline and
a current price both exist **in the same currency** — there is no FX anywhere in
this product, and comparing across currencies would produce a confident wrong
number. In every other case the current price shows alone, with no invented
comparison and never a zero.

The direction is stated in words, so it does not depend on colour.

## Limits

`MAX_WISHLIST_ITEMS = 50`, which bounds storage, the endpoint and how many items
one page load can price. At capacity the oldest entry makes way rather than the
save being refused.

## Discoverability

A heart icon in the header, with the accessible name "Wishlist". Not a fifth
navigation label — the header already carries four sections and a search field.
**No count badge**: hydrating a number from `localStorage` purely for decoration
would trade a real hydration risk for nothing.

## Not this phase

- **No wishlist buttons on cards.** `SkinCard`, recommendations, kits and Smart
  Loadout results have none; nesting an interactive control inside a card that
  is itself a link is a problem worth avoiding until there is a reason.
- **No builder integration.**
- **No sharing.** A wishlist is local; the builder already owns shareable
  loadouts.
- **No sorting controls.** Newest first. "Biggest drop" and "cheapest" are
  portfolio questions.
- **No total valuation.** Each item is judged on its own.
