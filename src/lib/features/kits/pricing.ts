/**
 * Joining a resolved kit to the market data loaded for it.
 *
 * Pure. Turns "here is a kit" plus "here is what the price service said about
 * each item" into the view model the page renders, and nothing else — no
 * fetching, no Svelte, no CS2Cap types.
 */
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { ResolvedKit, ResolvedKitItem } from '$lib/types/kit';

/**
 * What the market could tell us about one kit item.
 *
 * Three states, kept apart deliberately:
 *
 * - `priced` — loaded, and at least one quote can take part in a comparison.
 * - `no-quotes` — loaded, and nothing is currently listed. This is a fact
 *   about the market.
 * - `error` — the request failed. This is a fact about us.
 *
 * Collapsing the last two would tell a visitor "no marketplace sells this"
 * when the truth is "we could not ask", which is worse than saying nothing.
 */
export type KitItemPriceState = 'priced' | 'no-quotes' | 'error';

export type PricedKitItem = {
	item: ResolvedKitItem;
	/** Absent when the request failed; present but possibly empty otherwise. */
	prices: SkinMarketPrices | null;
	state: KitItemPriceState;
};

/** A priced kit: editorial identity plus whatever the market answered. */
export type PricedKit = Omit<ResolvedKit, 'items'> & {
	items: PricedKitItem[];
};

/**
 * A quote that may take part in a total.
 *
 * Both conditions are already applied upstream — the service excludes stale
 * quotes and ignores nonsense amounts when picking a best quote — so this is
 * defence in depth. A total is the number this product is judged on; it does
 * not get to trust that every layer above behaved.
 */
export function isUsableQuote(quote: MarketQuote): boolean {
	return !quote.stale && Number.isInteger(quote.priceMinor) && quote.priceMinor > 0;
}

/** Every quote for an item that may take part in a total, cheapest first. */
export function usableQuotes(priced: PricedKitItem): MarketQuote[] {
	if (!priced.prices) return [];

	return priced.prices.quotes
		.filter(isUsableQuote)
		.sort((a, b) => a.priceMinor - b.priceMinor || a.providerId.localeCompare(b.providerId));
}

/** The cheapest usable quote, or nothing when the market has no answer. */
export function cheapestQuote(priced: PricedKitItem): MarketQuote | undefined {
	return usableQuotes(priced)[0];
}

function stateFor(prices: SkinMarketPrices | null): KitItemPriceState {
	if (!prices) return 'error';

	return prices.quotes.some(isUsableQuote) ? 'priced' : 'no-quotes';
}

/**
 * Pairs each kit item with its prices, in editorial order.
 *
 * Prices arrive keyed by catalog item id — the id of the **exact variant the
 * kit names**, which is what was priced and what the page displays. An item
 * the loader said nothing about is an error, not an empty result.
 */
export function toPricedKit(
	kit: ResolvedKit,
	pricesByItemId: ReadonlyMap<number, SkinMarketPrices | null>
): PricedKit {
	const items = kit.items.map((item) => {
		const prices = pricesByItemId.get(item.variant.itemId) ?? null;

		return { item, prices, state: stateFor(prices) };
	});

	return { ...kit, items };
}

/** Kit items with no usable price, in editorial order. */
export function unpricedItems(items: readonly PricedKitItem[]): PricedKitItem[] {
	return items.filter((priced) => priced.state !== 'priced');
}

/**
 * Whether a whole-kit total may be shown.
 *
 * All or nothing, on purpose. A total assembled from four of five items looks
 * exactly like a total assembled from five, and a visitor has no way to tell
 * that the number in front of them is missing a skin. "Total unavailable" is
 * the honest answer and it costs nothing but a number.
 */
export function isFullyPriced(items: readonly PricedKitItem[]): boolean {
	return items.length > 0 && items.every((priced) => priced.state === 'priced');
}

/** The single item id each kit item is priced on. */
export function kitItemIds(kit: ResolvedKit): number[] {
	return kit.items.map((item) => item.variant.itemId);
}

export type { ResolvedKitItem };
