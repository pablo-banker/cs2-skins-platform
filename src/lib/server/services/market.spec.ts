import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getManySkinPrices,
	getMarketProviders,
	getSkinPriceHistory,
	getSkinPrices,
	INDIVIDUAL_PRICE_CONCURRENCY
} from './market';
import { serverCache } from '../cache/ttl-cache';
import type { MarketQuote } from '$lib/types/market';

// Batch mode is configuration, so the tests set it rather than discover it —
// which is exactly the property the service is supposed to have.
const { batchMode } = vi.hoisted(() => ({ batchMode: { enabled: false } }));

vi.mock('../providers/cs2cap/config', () => ({
	batchPricesEnabled: () => batchMode.enabled
}));

vi.mock('../providers/cs2cap/prices', () => ({
	getQuotesForItem: vi.fn(),
	getQuotesForItems: vi.fn()
}));
vi.mock('../providers/cs2cap/providers', () => ({ listProviders: vi.fn() }));
vi.mock('../providers/cs2cap/history', async (importOriginal) => ({
	// Keep the real default constants; only the network call is mocked.
	...(await importOriginal<typeof import('../providers/cs2cap/history')>()),
	getPriceHistory: vi.fn()
}));

const { getQuotesForItem, getQuotesForItems } = await import('../providers/cs2cap/prices');
const { listProviders } = await import('../providers/cs2cap/providers');
const { getPriceHistory } = await import('../providers/cs2cap/history');

const ITEM_ID = 12632;

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
	return {
		providerId: 'csfloat',
		itemId: ITEM_ID,
		priceMinor: 12873,
		currency: 'BRL',
		quantity: 3603,
		updatedAt: '2026-09-20T05:33:52.037775Z',
		stale: false,
		redirectUrl: 'https://cs2c.app/r/csfloat/12632',
		...overrides
	};
}

/** The provider layer already sorts cheapest-first; mirror that here. */
function quoteSet(quotes: MarketQuote[]) {
	return {
		itemId: ITEM_ID,
		currency: 'BRL',
		providersQueried: ['csfloat', 'steam', 'skinport'],
		quotes: [...quotes].sort((a, b) => a.priceMinor - b.priceMinor)
	};
}

beforeEach(() => {
	batchMode.enabled = false;
	vi.mocked(getQuotesForItems).mockReset();
	vi.mocked(getQuotesForItem).mockReset();
	vi.mocked(listProviders).mockReset();
	vi.mocked(getPriceHistory).mockReset();
	serverCache.clear();
});

describe('getSkinPrices', () => {
	it('requests BRL and excludes stale listings by default', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(quoteSet([quote()]));

		await getSkinPrices(ITEM_ID);

		expect(vi.mocked(getQuotesForItem).mock.calls[0][0]).toMatchObject({
			itemId: ITEM_ID,
			currency: 'BRL',
			excludeStale: true
		});
	});

	it('can be asked to include stale listings explicitly', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(quoteSet([quote()]));

		await getSkinPrices(ITEM_ID, { includeStale: true });

		expect(vi.mocked(getQuotesForItem).mock.calls[0][0]).toMatchObject({ excludeStale: false });
	});

	it('keeps amounts as integer minor units, untouched', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(quoteSet([quote({ priceMinor: 12828 })]));

		const prices = await getSkinPrices(ITEM_ID);

		expect(prices.quotes[0].priceMinor).toBe(12828);
		expect(Number.isInteger(prices.quotes[0].priceMinor)).toBe(true);
		expect(prices.currency).toBe('BRL');
	});

	it('returns quotes cheapest-first and picks the cheapest as best', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(
			quoteSet([
				quote({ providerId: 'steam', priceMinor: 16400 }),
				quote({ providerId: 'skinscom', priceMinor: 12828 }),
				quote({ providerId: 'csfloat', priceMinor: 12873 })
			])
		);

		const prices = await getSkinPrices(ITEM_ID);

		expect(prices.quotes.map((q) => q.providerId)).toEqual(['skinscom', 'csfloat', 'steam']);
		expect(prices.bestQuote?.providerId).toBe('skinscom');
		expect(prices.bestQuote?.priceMinor).toBe(12828);
	});

	it('never picks a stale quote as the best price', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(
			quoteSet([
				quote({ providerId: 'ghost', priceMinor: 9000, stale: true }),
				quote({ providerId: 'csfloat', priceMinor: 12873 })
			])
		);

		const prices = await getSkinPrices(ITEM_ID);

		expect(prices.quotes[0].providerId).toBe('ghost');
		expect(prices.bestQuote?.providerId).toBe('csfloat');
	});

	it('never picks a zero-amount quote as the best price', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(
			quoteSet([
				quote({ providerId: 'broken', priceMinor: 0 }),
				quote({ providerId: 'csfloat', priceMinor: 12873 })
			])
		);

		expect((await getSkinPrices(ITEM_ID)).bestQuote?.providerId).toBe('csfloat');
	});

	it('leaves bestQuote absent when nothing is comparable', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(
			quoteSet([quote({ priceMinor: 9000, stale: true })])
		);

		const prices = await getSkinPrices(ITEM_ID);

		expect(prices.quotes).toHaveLength(1);
		expect(prices.bestQuote).toBeUndefined();
	});

	it('caches quotes per item, currency and staleness setting', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(quoteSet([quote()]));

		await getSkinPrices(ITEM_ID);
		await getSkinPrices(ITEM_ID);
		expect(getQuotesForItem).toHaveBeenCalledTimes(1);

		await getSkinPrices(ITEM_ID, { currency: 'USD' });
		await getSkinPrices(ITEM_ID, { includeStale: true });
		expect(getQuotesForItem).toHaveBeenCalledTimes(3);
	});

	it('collapses concurrent requests for the same item into one upstream call', async () => {
		vi.mocked(getQuotesForItem).mockResolvedValue(quoteSet([quote()]));

		await Promise.all([getSkinPrices(ITEM_ID), getSkinPrices(ITEM_ID), getSkinPrices(ITEM_ID)]);

		expect(getQuotesForItem).toHaveBeenCalledTimes(1);
	});

	it('does not cache a failed price lookup', async () => {
		vi.mocked(getQuotesForItem)
			.mockRejectedValueOnce(new Error('429 rate limited'))
			.mockResolvedValueOnce(quoteSet([quote()]));

		await expect(getSkinPrices(ITEM_ID)).rejects.toThrow('429 rate limited');
		await expect(getSkinPrices(ITEM_ID)).resolves.toMatchObject({ itemId: ITEM_ID });
		expect(getQuotesForItem).toHaveBeenCalledTimes(2);
	});
});

describe('getSkinPriceHistory', () => {
	const history = {
		itemId: ITEM_ID,
		currency: 'BRL',
		interval: '1d',
		start: '2026-08-22T00:00:00Z',
		end: '2026-09-21T00:00:00Z',
		points: [
			{ timestamp: '2026-08-22T00:00:00.000Z', open: 13700, high: 13700, low: 13425, close: 13700 },
			{ timestamp: '2026-09-20T00:00:00.000Z', open: 12960, high: 12960, low: 12828, close: 12828 }
		]
	};

	it('defaults to 30 daily buckets in BRL', async () => {
		vi.mocked(getPriceHistory).mockResolvedValue(history);

		await getSkinPriceHistory(ITEM_ID);

		expect(vi.mocked(getPriceHistory).mock.calls[0][0]).toMatchObject({
			itemId: ITEM_ID,
			currency: 'BRL',
			interval: '1d',
			lookbackDays: 30
		});
	});

	it('returns points oldest-first in minor units', async () => {
		vi.mocked(getPriceHistory).mockResolvedValue(history);

		const result = await getSkinPriceHistory(ITEM_ID);

		expect(result.points.map((p) => p.timestamp)).toEqual([
			'2026-08-22T00:00:00.000Z',
			'2026-09-20T00:00:00.000Z'
		]);
		expect(result.points.at(-1)?.close).toBe(12828);
	});

	it('caches history per window', async () => {
		vi.mocked(getPriceHistory).mockResolvedValue(history);

		await getSkinPriceHistory(ITEM_ID);
		await getSkinPriceHistory(ITEM_ID);
		expect(getPriceHistory).toHaveBeenCalledTimes(1);

		await getSkinPriceHistory(ITEM_ID, { lookbackDays: 7 });
		expect(getPriceHistory).toHaveBeenCalledTimes(2);
	});
});

describe('getMarketProviders', () => {
	it('caches the provider directory so price calls never refetch it', async () => {
		vi.mocked(listProviders).mockResolvedValue([
			{ id: 'csfloat', name: 'CSFloat', status: 'up' },
			{ id: 'steam', name: 'Steam', status: 'up' }
		]);

		const first = await getMarketProviders();
		const second = await getMarketProviders();

		expect(listProviders).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
		expect(first.map((provider) => provider.id)).toEqual(['csfloat', 'steam']);
	});

	it('does not cache a failed provider lookup', async () => {
		vi.mocked(listProviders)
			.mockRejectedValueOnce(new Error('upstream down'))
			.mockResolvedValueOnce([{ id: 'csfloat', name: 'CSFloat', status: 'up' }]);

		await expect(getMarketProviders()).rejects.toThrow('upstream down');
		await expect(getMarketProviders()).resolves.toHaveLength(1);
		expect(listProviders).toHaveBeenCalledTimes(2);
	});
});

/**
 * Multi-item pricing: two transports, one contract.
 *
 * The point of these tests is that a caller cannot tell which mode ran —
 * except where the failure models genuinely differ, which is the one thing the
 * product does need to know about.
 */
function setFor(itemId: number, quotes: MarketQuote[]) {
	return {
		itemId,
		currency: 'BRL',
		providersQueried: ['csfloat', 'steam'],
		quotes: [...quotes].sort((a, b) => a.priceMinor - b.priceMinor)
	};
}

describe('getManySkinPrices in individual mode', () => {
	it('loads each item through the existing per-item path', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) =>
			setFor(itemId, [quote({ itemId, priceMinor: itemId })])
		);

		const results = await getManySkinPrices([1, 2, 3]);

		expect(getQuotesForItem).toHaveBeenCalledTimes(3);
		expect(getQuotesForItems).not.toHaveBeenCalled();
		expect(results.map((result) => result.itemId)).toEqual([1, 2, 3]);
		expect(results.every((result) => result.state === 'loaded')).toBe(true);
	});

	it('picks a best quote per item, as the single-item path does', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) =>
			setFor(itemId, [
				quote({ itemId, providerId: 'csfloat', priceMinor: 900 }),
				quote({ itemId, providerId: 'steam', priceMinor: 700 })
			])
		);

		const [result] = await getManySkinPrices([1]);

		expect(result.prices?.bestQuote?.providerId).toBe('steam');
	});

	it('never exceeds the concurrency limit', async () => {
		let inFlight = 0;
		let peak = 0;

		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) => {
			inFlight++;
			peak = Math.max(peak, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 1));
			inFlight--;

			return setFor(itemId, [quote({ itemId })]);
		});

		await getManySkinPrices([1, 2, 3, 4, 5, 6, 7, 8]);

		expect(peak).toBeLessThanOrEqual(INDIVIDUAL_PRICE_CONCURRENCY);
		expect(peak).toBeGreaterThan(1);
	});

	it('loads a duplicated id once and still answers for both positions', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) =>
			setFor(itemId, [quote({ itemId })])
		);

		const results = await getManySkinPrices([5, 5, 6]);

		expect(getQuotesForItem).toHaveBeenCalledTimes(2);
		expect(results.map((result) => result.itemId)).toEqual([5, 5, 6]);
	});

	it('reuses the per-item cache across calls', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) =>
			setFor(itemId, [quote({ itemId })])
		);

		await getManySkinPrices([1, 2]);
		await getSkinPrices(1);

		// A kit and the skin pages it links to share cache entries.
		expect(getQuotesForItem).toHaveBeenCalledTimes(2);
	});

	it('keeps every other item when one request fails', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) => {
			if (itemId === 2) throw new Error('upstream exploded');

			return setFor(itemId, [quote({ itemId })]);
		});

		const results = await getManySkinPrices([1, 2, 3]);

		expect(results.map((result) => result.state)).toEqual(['loaded', 'error', 'loaded']);
		expect(results[1].prices).toBeNull();
	});

	it('distinguishes an item with no quotes from an item that failed', async () => {
		vi.mocked(getQuotesForItem).mockImplementation(async ({ itemId }) => {
			if (itemId === 2) throw new Error('upstream exploded');

			return setFor(itemId, []);
		});

		const [empty, failed] = await getManySkinPrices([1, 2]);

		expect(empty.state).toBe('loaded');
		expect(empty.prices?.quotes).toEqual([]);
		expect(failed.state).toBe('error');
	});

	it('asks for nothing when given no ids', async () => {
		await expect(getManySkinPrices([])).resolves.toEqual([]);
		expect(getQuotesForItem).not.toHaveBeenCalled();
	});
});

describe('getManySkinPrices in batch mode', () => {
	beforeEach(() => {
		batchMode.enabled = true;
	});

	it('makes exactly one provider call for the whole set', async () => {
		vi.mocked(getQuotesForItems).mockResolvedValue([
			setFor(1, [quote({ itemId: 1 })]),
			setFor(2, [quote({ itemId: 2 })])
		]);

		const results = await getManySkinPrices([1, 2]);

		expect(getQuotesForItems).toHaveBeenCalledTimes(1);
		expect(getQuotesForItem).not.toHaveBeenCalled();
		expect(results.map((result) => result.itemId)).toEqual([1, 2]);
	});

	it('requests BRL with stale quotes excluded', async () => {
		vi.mocked(getQuotesForItems).mockResolvedValue([setFor(1, [])]);

		await getManySkinPrices([1]);

		expect(getQuotesForItems).toHaveBeenCalledWith(
			expect.objectContaining({ currency: 'BRL', excludeStale: true }),
			expect.anything()
		);
	});

	it('deduplicates ids before asking', async () => {
		vi.mocked(getQuotesForItems).mockResolvedValue([setFor(4, [])]);

		await getManySkinPrices([4, 4, 4]);

		expect(vi.mocked(getQuotesForItems).mock.calls[0][0].itemIds).toEqual([4]);
	});

	it('caches the whole batch, so a second render costs nothing', async () => {
		vi.mocked(getQuotesForItems).mockResolvedValue([setFor(1, []), setFor(2, [])]);

		await getManySkinPrices([1, 2]);
		await getManySkinPrices([2, 1]);

		// Sorted ids make a reordered kit the same request.
		expect(getQuotesForItems).toHaveBeenCalledTimes(1);
	});

	it('picks a best quote per item, as individual mode does', async () => {
		vi.mocked(getQuotesForItems).mockResolvedValue([
			setFor(1, [
				quote({ itemId: 1, providerId: 'csfloat', priceMinor: 900 }),
				quote({ itemId: 1, providerId: 'steam', priceMinor: 700 })
			])
		]);

		const [result] = await getManySkinPrices([1]);

		expect(result.prices?.bestQuote?.providerId).toBe('steam');
	});

	it('marks every item as failed when the one request fails, without throwing', async () => {
		vi.mocked(getQuotesForItems).mockRejectedValue(new Error('403 from upstream'));

		const results = await getManySkinPrices([1, 2, 3]);

		expect(results.map((result) => result.state)).toEqual(['error', 'error', 'error']);
		expect(results.every((result) => result.prices === null)).toBe(true);
	});

	it('exposes nothing about why the batch failed', async () => {
		vi.mocked(getQuotesForItems).mockRejectedValue(
			new Error('CS2Cap /prices/batch failed with 403')
		);

		const results = await getManySkinPrices([1]);

		expect(JSON.stringify(results)).not.toMatch(/CS2Cap|403|batch/i);
	});

	it('does not cache a failed batch', async () => {
		vi.mocked(getQuotesForItems)
			.mockRejectedValueOnce(new Error('transient'))
			.mockResolvedValueOnce([setFor(1, [quote({ itemId: 1 })])]);

		const first = await getManySkinPrices([1]);
		const second = await getManySkinPrices([1]);

		expect(first[0].state).toBe('error');
		expect(second[0].state).toBe('loaded');
	});
});
