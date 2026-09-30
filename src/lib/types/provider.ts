/**
 * A marketplace as our application understands it.
 *
 * Marketplaces are not integrated directly — they are surfaced through CS2Cap
 * (see docs/PROVIDERS.md). This type is what product code consumes; the raw
 * CS2Cap provider payload never leaves the integration layer.
 */
export type MarketProvider = {
	/** Stable provider key used in quotes and requests, e.g. `csfloat`. */
	id: string;
	/** Display name, e.g. `CSFloat`. */
	name: string;
	logoUrl?: string;
	/** Provider classification reported upstream, e.g. `P2P`. */
	marketType?: string;
	status: MarketProviderStatus;
	/** ISO 8601 timestamp of the last upstream health check. */
	lastCheckedAt?: string;
};

/**
 * Health of a provider's data feed.
 *
 * `unknown` covers any upstream status we do not recognise, so an unexpected
 * value degrades the badge rather than breaking the comparison.
 */
export type MarketProviderStatus = 'up' | 'degraded' | 'down' | 'unknown';
