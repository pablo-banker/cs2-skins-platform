import { describe, expect, it } from 'vitest';
import { bestProvider, toQuoteRows } from './price-comparison';
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';

function quote(providerId: string, priceMinor: number, overrides: Partial<MarketQuote> = {}) {
	return {
		providerId,
		itemId: 12632,
		priceMinor,
		currency: 'BRL',
		quantity: 10,
		stale: false,
		redirectUrl: `https://cs2c.app/r/${providerId}/12632`,
		...overrides
	} satisfies MarketQuote;
}

const providers: MarketProvider[] = [
	{ id: 'skinscom', name: 'Skins.com', marketType: 'P2P', status: 'up' },
	{ id: 'csmoney_m', name: 'CS.MONEY - Market', marketType: 'HYBRID', status: 'up' },
	{ id: 'csmoney_t', name: 'CS.MONEY - Trade', marketType: 'TRADING', status: 'up' }
];

function prices(quotes: MarketQuote[]): SkinMarketPrices {
	const sorted = [...quotes].sort((a, b) => a.priceMinor - b.priceMinor);

	return {
		itemId: 12632,
		currency: 'BRL',
		providersQueried: providers.map((p) => p.id),
		quotes: sorted,
		bestQuote: sorted.find((q) => !q.stale && q.priceMinor > 0)
	};
}

describe('toQuoteRows', () => {
	it('keeps quotes cheapest-first and marks the best one', () => {
		const rows = toQuoteRows(
			prices([quote('csmoney_m', 13451), quote('skinscom', 12828)]),
			providers
		);

		expect(rows.map((row) => row.quote.providerId)).toEqual(['skinscom', 'csmoney_m']);
		expect(rows[0].best).toBe(true);
		expect(rows[1].best).toBe(false);
	});

	it('joins provider metadata onto each quote', () => {
		const rows = toQuoteRows(prices([quote('skinscom', 12828)]), providers);

		expect(rows[0].provider?.name).toBe('Skins.com');
		expect(rows[0].provider?.marketType).toBe('P2P');
	});

	it('keeps a quote whose provider is missing from the directory', () => {
		// A real price is worth more than its branding.
		const rows = toQuoteRows(prices([quote('mystery', 11900)]), providers);

		expect(rows).toHaveLength(1);
		expect(rows[0].provider).toBeUndefined();
		expect(rows[0].quote.providerId).toBe('mystery');
	});

	it('survives an empty provider directory', () => {
		const rows = toQuoteRows(prices([quote('skinscom', 12828)]), []);

		expect(rows).toHaveLength(1);
		expect(rows[0].best).toBe(true);
	});

	it('keeps one brand’s market modes as separate prices', () => {
		// CS.MONEY's market and trade sides are genuinely different offers.
		const rows = toQuoteRows(
			prices([quote('csmoney_t', 14555), quote('csmoney_m', 13451)]),
			providers
		);

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.provider?.name)).toEqual([
			'CS.MONEY - Market',
			'CS.MONEY - Trade'
		]);
	});

	it('preserves the tracked redirect', () => {
		const rows = toQuoteRows(prices([quote('skinscom', 12828)]), providers);

		expect(rows[0].quote.redirectUrl).toBe('https://cs2c.app/r/skinscom/12632');
	});

	it('returns nothing when prices failed to load', () => {
		expect(toQuoteRows(null, providers)).toEqual([]);
	});

	it('never marks a stale or zero quote as best', () => {
		const rows = toQuoteRows(
			prices([quote('ghost', 9000, { stale: true }), quote('broken', 0), quote('skinscom', 12828)]),
			providers
		);

		expect(rows.find((row) => row.best)?.quote.providerId).toBe('skinscom');
	});
});

describe('bestProvider', () => {
	it('resolves the provider behind the best quote', () => {
		expect(bestProvider(prices([quote('skinscom', 12828)]), providers)?.name).toBe('Skins.com');
	});

	it('is undefined when there is no best quote or no match', () => {
		expect(bestProvider(null, providers)).toBeUndefined();
		expect(bestProvider(prices([quote('mystery', 100)]), providers)).toBeUndefined();
	});
});
