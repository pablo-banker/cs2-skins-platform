/**
 * CS2Cap live prices (`GET /prices`).
 *
 * Every value here is a **lowest ask**: the cheapest price currently listed on
 * that provider. Not an average, not a last sale, not a valuation.
 */
import type { MarketQuote, MarketQuoteSet } from '$lib/types/market';
import {
	CS2CAP_DEFAULT_CURRENCY,
	CS2CapError,
	requestCs2Cap,
	type Cs2CapRequestOptions
} from './client';
import { sortQuotesByPrice, toBatchMarketQuote, toMarketQuote } from './mappers';
import { cs2capBatchPricesResponseSchema, cs2capPricesResponseSchema } from './schemas';

/** One row per provider; 40-odd providers is the realistic ceiling. */
const MAX_QUOTES = 100;

export type GetQuotesParams = {
	/** Catalog item id — the fastest and least ambiguous lookup. */
	itemId: number;
	/** ISO 4217 code. Defaults to BRL, the product-facing currency. */
	currency?: string;
	/** Restrict to specific provider keys. Omit for every provider. */
	providerIds?: string[];
	/**
	 * Leave out listings the provider's latest scan did not include.
	 * Defaults to `true`: a comparison table should not rank a price that may
	 * no longer be buyable.
	 */
	excludeStale?: boolean;
};

/** Live quotes for one variant across the marketplaces that carry it. */
export async function getQuotesForItem(
	params: GetQuotesParams,
	options: Cs2CapRequestOptions = {}
): Promise<MarketQuoteSet> {
	const currency = params.currency ?? CS2CAP_DEFAULT_CURRENCY;

	const response = await requestCs2Cap(
		'/prices',
		{
			schema: cs2capPricesResponseSchema,
			query: {
				item_id: params.itemId,
				currency,
				providers: params.providerIds,
				exclude_stale: params.excludeStale ?? true,
				limit: MAX_QUOTES
			}
		},
		options
	);

	const quotes: MarketQuote[] = response.items.map((item) =>
		toMarketQuote(item, response.meta.currency)
	);

	return {
		itemId: params.itemId,
		currency: response.meta.currency,
		providersQueried: response.meta.providers_queried,
		quotes: sortQuotesByPrice(quotes)
	};
}

/**
 * Upstream's documented ceiling for one batch lookup.
 *
 * Editorial kits hold at most eight items, so this is a guard rather than a
 * limit we work around: a caller that exceeds it has a bug, not a large kit.
 */
export const MAX_BATCH_ITEMS = 100;

/**
 * Live quotes for several variants in one request (`POST /prices/batch`).
 *
 * Requires a CS2Cap plan that includes batch lookups — on a plan without it,
 * upstream answers 403 and this raises a `forbidden` `CS2CapError`. That is
 * deliberate: the caller decides whether batch is enabled, and a misconfigured
 * deployment should be visible rather than silently downgraded.
 *
 * Returns one quote set **per requested id**, including ids upstream reported
 * nothing for — the caller asked about them and is entitled to an answer.
 */
export async function getQuotesForItems(
	params: Omit<GetQuotesParams, 'itemId'> & { itemIds: number[] },
	options: Cs2CapRequestOptions = {}
): Promise<MarketQuoteSet[]> {
	const currency = params.currency ?? CS2CAP_DEFAULT_CURRENCY;
	const itemIds = [...new Set(params.itemIds)];

	if (itemIds.length === 0) return [];

	if (itemIds.length > MAX_BATCH_ITEMS) {
		throw new CS2CapError(
			'upstream',
			`A batch price lookup takes at most ${MAX_BATCH_ITEMS} items; ${itemIds.length} were requested.`
		);
	}

	const response = await requestCs2Cap(
		'/prices/batch',
		{
			schema: cs2capBatchPricesResponseSchema,
			body: {
				item_ids: itemIds,
				currency,
				providers: params.providerIds,
				exclude_stale: params.excludeStale ?? true
			}
		},
		options
	);

	const byItemId = new Map(
		response.items.map((item) => [
			item.item_id,
			item.quotes.map((quote) => toBatchMarketQuote(quote, item.item_id, response.meta.currency))
		])
	);

	return itemIds.map((itemId) => ({
		itemId,
		currency: response.meta.currency,
		providersQueried: response.meta.providers_queried,
		quotes: sortQuotesByPrice(byItemId.get(itemId) ?? [])
	}));
}
