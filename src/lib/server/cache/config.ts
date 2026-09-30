/**
 * Cache policy, in one place.
 *
 * These are **application** cache lifetimes — how long we are willing to serve
 * a value we already have. They are not claims about how often CS2Cap refreshes
 * upstream, and they are unrelated to CS2Cap's own `stale` flag on a quote.
 *
 * The CS2Cap plan has a finite monthly quota, so every TTL here is also quota
 * protection: the cheapest upstream request is the one we do not make.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const CACHE_TTL = {
	/**
	 * A skin's catalog record — names, rarity, collection, floats, variant set.
	 * This changes when Valve ships an update, not during a browsing session.
	 */
	catalogItem: 1 * HOUR,

	/**
	 * Search results. Shorter than a catalog item because the *set* of matches
	 * shifts as the catalog grows, and because searches are long-tail: a short
	 * life keeps rare queries from holding memory.
	 */
	catalogSearch: 15 * MINUTE,

	/**
	 * The filter vocabulary (weapon types, wears, rarities, collections).
	 * Effectively static between game updates, and every Explore page render
	 * would otherwise ask for it.
	 */
	catalogMetadata: 6 * HOUR,

	/**
	 * The full weapon-skin index that Explore browses.
	 *
	 * One upstream request of roughly 20MB, so this TTL matters more than any
	 * other: the catalog only changes when Valve ships an update, and every
	 * filter, sort and page is served from the one cached copy.
	 */
	catalogIndex: 6 * HOUR,

	/**
	 * The marketplace directory. Slow-moving, but it carries health status, so
	 * an outage should surface within minutes rather than hours.
	 */
	providers: 10 * MINUTE,

	/**
	 * Live quotes. The shortest TTL we keep: this is the number the whole
	 * product is judged on. Upstream refreshes on the order of 5–10 minutes,
	 * so a shorter TTL would mostly buy duplicate requests, not fresher data.
	 */
	prices: 5 * MINUTE,

	/**
	 * Daily OHLC candles. The current bucket only closes once a day, so a
	 * 30-minute life costs nothing in accuracy.
	 */
	priceHistory: 30 * MINUTE
} as const;

/**
 * Hard ceiling on cached entries.
 *
 * Search keys are unbounded by nature — any string a visitor types is a new
 * key — so the cache must have a cap or it becomes a memory leak with good
 * intentions. At a few KB per entry this is a low-single-digit-MB ceiling.
 */
export const CACHE_MAX_ENTRIES = 500;
