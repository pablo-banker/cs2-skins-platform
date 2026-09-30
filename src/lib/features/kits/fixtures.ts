/**
 * Shared fixtures for the kit pricing and strategy tests.
 *
 * Kept out of the spec files because three suites need the same shapes, and a
 * plan built from a slightly different fixture proves slightly less than it
 * looks like it does.
 */
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { ResolvedKit, ResolvedKitItem } from '$lib/types/kit';
import type { PricedKitItem } from './pricing';

export function variantFor(index: number) {
	return {
		itemId: 1000 + index,
		marketHashName: `Weapon ${index} | Finish ${index} (Field-Tested)`,
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false
	};
}

export function kitItem(index: number): ResolvedKitItem {
	return {
		skin: {
			id: `weapon-${index}-finish-${index}`,
			weapon: `Weapon ${index}`,
			name: `Finish ${index}`,
			fullName: `Weapon ${index} | Finish ${index}`,
			variants: [variantFor(index)]
		},
		variant: variantFor(index)
	};
}

export function quote(
	providerId: string,
	priceMinor: number,
	itemId: number,
	overrides: Partial<MarketQuote> = {}
): MarketQuote {
	return {
		providerId,
		itemId,
		priceMinor,
		currency: 'BRL',
		quantity: 4,
		stale: false,
		redirectUrl: `https://cs2c.app/r/${providerId}/${itemId}`,
		...overrides
	};
}

/** One item, its quotes given as `[providerId, priceMinor]` pairs. */
export function priced(
	index: number,
	offers: [string, number][],
	overrides: Partial<MarketQuote> = {}
): PricedKitItem {
	const item = kitItem(index);
	const itemId = item.variant.itemId;

	const prices: SkinMarketPrices = {
		itemId,
		currency: 'BRL',
		providersQueried: offers.map(([providerId]) => providerId),
		quotes: offers.map(([providerId, priceMinor]) =>
			quote(providerId, priceMinor, itemId, overrides)
		)
	};

	return { item, prices, state: prices.quotes.length > 0 ? 'priced' : 'no-quotes' };
}

/** An item whose price request failed — different from having no quotes. */
export function failedItem(index: number): PricedKitItem {
	return { item: kitItem(index), prices: null, state: 'error' };
}

/** An item that loaded with nothing currently listed. */
export function emptyItem(index: number): PricedKitItem {
	return priced(index, []);
}

export function resolvedKit(indexes: number[]): ResolvedKit {
	return {
		slug: 'test-kit',
		name: 'Test Kit',
		description: 'A kit that exists only in the tests.',
		category: 'color',
		tags: ['red'],
		items: indexes.map(kitItem)
	};
}

/** Provider ids used by the assignment, in item order. */
export function providersOf(lines: { quote: MarketQuote }[]): string[] {
	return lines.map((line) => line.quote.providerId);
}
