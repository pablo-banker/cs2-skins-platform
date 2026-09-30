/**
 * One OHLC bucket of price history.
 *
 * All money values are in **minor units** of the series currency, consistent
 * with `MarketQuote`. The series is composite: each bucket is aggregated
 * across providers rather than being one marketplace's own history.
 */
export type PriceHistoryPoint = {
	/** ISO 8601 UTC timestamp for the start of the bucket. */
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	/** Estimated trade volume for the bucket, inferred from inventory changes. */
	volume?: number;
	/** Active listing count at the end of the bucket, when known. */
	listings?: number;
};

/** A price history series for a single catalog item. */
export type PriceHistory = {
	itemId: number;
	currency: string;
	/** Bucket size, e.g. `1d`. */
	interval: string;
	/** Inclusive ISO 8601 start of the requested window. */
	start: string;
	/** Exclusive ISO 8601 end of the requested window. */
	end: string;
	points: PriceHistoryPoint[];
};
