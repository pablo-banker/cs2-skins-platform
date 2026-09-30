/**
 * A price quote for one item on one marketplace.
 *
 * This is an **ask**: the lowest price currently listed for that item on that
 * provider. It is not an average, a last sale, a fair value or a market value.
 *
 * Money is carried in **minor units** of `currency` (e.g. `14250` with
 * currency `BRL` means R$ 142,50). Amounts stay integers end to end; the
 * conversion to a decimal happens once, at the moment of display.
 */
export type MarketQuote = {
	/** Provider key — matches `MarketProvider.id`. */
	providerId: string;
	/** Catalog item id of the exact variant this quote is for. */
	itemId: number;
	/** Lowest current ask, in minor units of `currency`. */
	priceMinor: number;
	/** ISO 4217 code, e.g. `BRL`. */
	currency: string;
	/**
	 * Quantity reported by CS2Cap alongside this quote.
	 *
	 * Treat it as an availability signal, not a guaranteed inventory count: it
	 * is what the provider's latest scan saw around this quote, not a promise
	 * about total marketplace stock. Label it carefully if it is ever shown.
	 */
	quantity: number;
	/** ISO 8601 timestamp of the last upstream refresh for this quote. */
	updatedAt?: string;
	/**
	 * `true` when the provider's most recent scan did not include this listing:
	 * the price is the last one observed and may no longer be available.
	 */
	stale: boolean;
	/** Tracked link out to the listing. May carry referral attribution. */
	redirectUrl?: string;
};

/** The quotes for one item across every provider that carries it. */
export type MarketQuoteSet = {
	itemId: number;
	currency: string;
	/** Provider keys that were queried, including those with no result. */
	providersQueried: string[];
	quotes: MarketQuote[];
};

/**
 * What the market service hands to the application for one item.
 *
 * `bestQuote` is computed here rather than in every caller, because "the
 * cheapest usable offer" is the single question the whole product asks and it
 * should have exactly one answer.
 */
export type SkinMarketPrices = MarketQuoteSet & {
	/**
	 * Cheapest quote that can safely take part in a comparison: not stale, and
	 * a positive amount. Absent when no quote qualifies — which is different
	 * from having no quotes at all.
	 */
	bestQuote?: MarketQuote;
};
