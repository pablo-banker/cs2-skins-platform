/**
 * Preparing market data for the comparison view.
 *
 * Pure. Joins quotes with provider metadata for display without touching the
 * domain types — a `MarketQuote` carries a `providerId` and nothing more, so
 * thirty quotes do not drag thirty copies of the same provider object.
 */
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';

export type QuoteRow = {
	quote: MarketQuote;
	/** Resolved provider, when the directory had one. */
	provider?: MarketProvider;
	/** True for the cheapest quote that can take part in a comparison. */
	best: boolean;
};

/**
 * Pairs each quote with its provider.
 *
 * A quote whose provider is missing from the directory is **kept**: the price
 * is real and useful, and the row falls back to the provider key. Losing a
 * valid price because its logo is missing would be the wrong trade.
 *
 * Providers that expose several market modes under one brand — CS.MONEY's
 * market and trade sides, for instance — arrive as separate providers upstream
 * and stay separate here. They are genuinely different prices.
 */
export function toQuoteRows(
	prices: SkinMarketPrices | null,
	providers: readonly MarketProvider[]
): QuoteRow[] {
	if (!prices) return [];

	const byId = new Map(providers.map((provider) => [provider.id, provider]));

	return prices.quotes.map((quote) => ({
		quote,
		provider: byId.get(quote.providerId),
		best: prices.bestQuote?.providerId === quote.providerId
	}));
}

/** The provider behind the best quote, for the summary. */
export function bestProvider(
	prices: SkinMarketPrices | null,
	providers: readonly MarketProvider[]
): MarketProvider | undefined {
	if (!prices?.bestQuote) return undefined;

	return providers.find((provider) => provider.id === prices.bestQuote?.providerId);
}
