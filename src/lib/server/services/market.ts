/**
 * Market operations for the application: live quotes, price history and the
 * marketplace directory.
 *
 * Like the catalog service, this is the boundary product code talks to. It
 * owns the defaults that make quotes comparable — BRL, stale excluded,
 * cheapest first — so no caller has to remember them.
 */
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { PriceHistory } from '$lib/types/price-history';
import { CS2CAP_DEFAULT_CURRENCY, type Cs2CapRequestOptions } from '../providers/cs2cap/client';
import { batchPricesEnabled } from '../providers/cs2cap/config';
import {
	DEFAULT_HISTORY_INTERVAL,
	DEFAULT_HISTORY_LOOKBACK_DAYS,
	getPriceHistory
} from '../providers/cs2cap/history';
import { getQuotesForItem, getQuotesForItems } from '../providers/cs2cap/prices';
import { listProviders } from '../providers/cs2cap/providers';
import { CACHE_TTL } from '../cache/config';
import { cacheKeys } from '../cache/keys';
import { serverCache } from '../cache/ttl-cache';

export type GetSkinPricesOptions = Cs2CapRequestOptions & {
	/** ISO 4217 code. Defaults to BRL, the product-facing currency. */
	currency?: string;
	/** Restrict to specific provider keys. Omit for every provider. */
	providerIds?: string[];
	/**
	 * Include listings the provider's latest scan did not see. Defaults to
	 * `false` — a comparison should not rank an offer that may be gone.
	 */
	includeStale?: boolean;
};

/**
 * The cheapest quote that can safely take part in a comparison.
 *
 * Quotes arrive cheapest-first, so this is the first one that is neither stale
 * nor a nonsense amount. A stale quote is a price we saw once, not a price
 * anyone can pay, and zero is upstream noise — ranking either as "best price"
 * would be the single most damaging bug this product could ship.
 */
function pickBestQuote(quotes: MarketQuote[]): MarketQuote | undefined {
	return quotes.find((quote) => !quote.stale && quote.priceMinor > 0);
}

/**
 * Live quotes for one catalog variant, cheapest first, with the best usable
 * quote already picked out.
 *
 * Amounts stay in integer minor units of `currency`; no conversion happens
 * here or anywhere else on the server.
 */
export async function getSkinPrices(
	itemId: number,
	options: GetSkinPricesOptions = {}
): Promise<SkinMarketPrices> {
	const currency = options.currency ?? CS2CAP_DEFAULT_CURRENCY;
	const excludeStale = options.includeStale !== true;

	const key = cacheKeys.prices({
		itemId,
		currency,
		providerIds: options.providerIds,
		excludeStale
	});

	return serverCache.getOrLoad(key, CACHE_TTL.prices, async () => {
		const quoteSet = await getQuotesForItem(
			{ itemId, currency, providerIds: options.providerIds, excludeStale },
			{ fetch: options.fetch }
		);

		return { ...quoteSet, bestQuote: pickBestQuote(quoteSet.quotes) };
	});
}

/**
 * What one item's pricing came back as.
 *
 * `loaded` with no usable quote and `error` are **different answers** and the
 * product must never merge them: "no marketplace currently lists this" is
 * information, "we could not ask" is an outage. A caller that conflates them
 * tells the visitor something untrue about the market.
 */
export type ItemPricesResult =
	| { itemId: number; state: 'loaded'; prices: SkinMarketPrices }
	| { itemId: number; state: 'error'; prices: null };

/**
 * How many individual price requests may be in flight at once.
 *
 * Small on purpose. Editorial kits hold at most eight items, and upstream has
 * a per-minute burst limit shared with every other request the page makes —
 * an unbounded `Promise.all` would spend the whole burst allowance on one kit.
 */
export const INDIVIDUAL_PRICE_CONCURRENCY = 4;

/** Runs `task` over `items`, never more than `limit` at a time, input-ordered. */
async function mapWithConcurrency<TIn, TOut>(
	items: readonly TIn[],
	limit: number,
	task: (item: TIn) => Promise<TOut>
): Promise<TOut[]> {
	const results = new Array<TOut>(items.length);
	let next = 0;

	async function worker(): Promise<void> {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));

	return results;
}

/**
 * Live quotes for several variants at once — what a kit needs.
 *
 * Two transports, one result shape. Which one runs is **configuration**
 * (`CS2CAP_BATCH_PRICES_ENABLED`), never a guess and never a probe, and the
 * caller cannot tell them apart: both return one `ItemPricesResult` per
 * requested id, in request order, with duplicates collapsed.
 *
 * The failure models genuinely differ, and that is the honest thing to expose:
 *
 * - **Individual** — each item succeeds or fails on its own, so one bad
 *   request cannot erase seven good prices.
 * - **Batch** — one request, so it succeeds or fails as a whole. A failure
 *   marks every item `error`; it does not throw, because a kit's identity is
 *   not market data and the page must still render.
 */
export async function getManySkinPrices(
	itemIds: readonly number[],
	options: GetSkinPricesOptions = {}
): Promise<ItemPricesResult[]> {
	const unique = [...new Set(itemIds)];
	if (unique.length === 0) return [];

	const results = batchPricesEnabled()
		? await loadPricesInBatch(unique, options)
		: await loadPricesIndividually(unique, options);

	const byItemId = new Map(results.map((result) => [result.itemId, result]));

	// Requested order, duplicates included: the caller asked about each id and
	// is entitled to an answer for each.
	return itemIds.map(
		(itemId) => byItemId.get(itemId) ?? { itemId, state: 'error' as const, prices: null }
	);
}

/**
 * One request for the whole set, cached as a whole.
 *
 * The batch result is deliberately **not** split into per-item cache entries.
 * Doing so would mean a later single-item request silently served a value
 * fetched under different parameters, and the win — a warm skin page after
 * opening a kit — is not worth blurring which request produced which cached
 * value. A kit re-opened inside five minutes costs nothing either way.
 */
async function loadPricesInBatch(
	itemIds: number[],
	options: GetSkinPricesOptions
): Promise<ItemPricesResult[]> {
	const currency = options.currency ?? CS2CAP_DEFAULT_CURRENCY;
	const excludeStale = options.includeStale !== true;

	const key = cacheKeys.pricesBatch({
		itemIds,
		currency,
		providerIds: options.providerIds,
		excludeStale
	});

	try {
		const sets = await serverCache.getOrLoad(key, CACHE_TTL.prices, async () => {
			const quoteSets = await getQuotesForItems(
				{ itemIds, currency, providerIds: options.providerIds, excludeStale },
				{ fetch: options.fetch }
			);

			return quoteSets.map((set) => ({ ...set, bestQuote: pickBestQuote(set.quotes) }));
		});

		return sets.map((prices) => ({ itemId: prices.itemId, state: 'loaded' as const, prices }));
	} catch {
		// The error is not swallowed — `serverCache` caches nothing on failure,
		// so the next render retries and the thrown `CS2CapError` has already
		// surfaced server-side. What must not happen is a 500 on a page whose
		// catalog identity loaded perfectly well.
		return itemIds.map((itemId) => ({ itemId, state: 'error' as const, prices: null }));
	}
}

/**
 * One request per item, bounded, through the existing per-item cache.
 *
 * Reuses `getSkinPrices` rather than reimplementing it, so a kit and a skin
 * page share cache entries: opening a kit warms every skin page it links to.
 */
async function loadPricesIndividually(
	itemIds: number[],
	options: GetSkinPricesOptions
): Promise<ItemPricesResult[]> {
	return mapWithConcurrency(
		itemIds,
		INDIVIDUAL_PRICE_CONCURRENCY,
		async (itemId): Promise<ItemPricesResult> => {
			try {
				return { itemId, state: 'loaded', prices: await getSkinPrices(itemId, options) };
			} catch {
				return { itemId, state: 'error', prices: null };
			}
		}
	);
}

export type GetPriceHistoryOptions = Cs2CapRequestOptions & {
	currency?: string;
	/** Whole days to look back. The current plan caps this at 30. */
	lookbackDays?: number;
	/** Bucket size. `1d` is the only interval the current plan allows. */
	interval?: string;
};

/**
 * Price history for one catalog variant — 30 daily buckets in BRL by default,
 * oldest first.
 *
 * No chart-shaped formatting happens here. Turning a series into axes and
 * paths is the UI's job.
 */
export async function getSkinPriceHistory(
	itemId: number,
	options: GetPriceHistoryOptions = {}
): Promise<PriceHistory> {
	const currency = options.currency ?? CS2CAP_DEFAULT_CURRENCY;
	const interval = options.interval ?? DEFAULT_HISTORY_INTERVAL;
	const lookbackDays = options.lookbackDays ?? DEFAULT_HISTORY_LOOKBACK_DAYS;

	const key = cacheKeys.priceHistory({ itemId, currency, interval, lookbackDays });

	return serverCache.getOrLoad(key, CACHE_TTL.priceHistory, () =>
		getPriceHistory({ itemId, currency, interval, lookbackDays }, { fetch: options.fetch })
	);
}

/**
 * The marketplace directory, cached so a price comparison never has to fetch
 * it alongside every quote.
 *
 * Quotes carry a `providerId` and nothing more. A caller that needs a logo or
 * a display name joins against this list once, rather than every quote
 * dragging a copy of the same provider object.
 */
export async function getMarketProviders(
	options: Cs2CapRequestOptions = {}
): Promise<MarketProvider[]> {
	return serverCache.getOrLoad(cacheKeys.providers(), CACHE_TTL.providers, () =>
		listProviders(options)
	);
}
