import { describe, expect, it } from 'vitest';
import {
	cheapestQuote,
	isFullyPriced,
	isUsableQuote,
	kitItemIds,
	toPricedKit,
	unpricedItems,
	usableQuotes
} from './pricing';
import { emptyItem, failedItem, priced, quote, resolvedKit, variantFor } from './fixtures';
import type { SkinMarketPrices } from '$lib/types/market';

describe('isUsableQuote', () => {
	it('accepts a real current offer', () => {
		expect(isUsableQuote(quote('steam', 1000, 1))).toBe(true);
	});

	it('rejects a stale quote', () => {
		// A price we saw once is not a price anyone can pay.
		expect(isUsableQuote(quote('steam', 1000, 1, { stale: true }))).toBe(false);
	});

	it('rejects zero and negative amounts', () => {
		expect(isUsableQuote(quote('steam', 0, 1))).toBe(false);
		expect(isUsableQuote(quote('steam', -500, 1))).toBe(false);
	});

	it('rejects a fractional amount — money here is integer minor units', () => {
		expect(isUsableQuote(quote('steam', 1000.5, 1))).toBe(false);
	});
});

describe('usableQuotes', () => {
	it('returns the usable quotes cheapest first', () => {
		const item = priced(1, [
			['csfloat', 900],
			['steam', 700],
			['skinport', 800]
		]);

		expect(usableQuotes(item).map((entry) => entry.providerId)).toEqual([
			'steam',
			'skinport',
			'csfloat'
		]);
	});

	it('breaks a price tie on provider id, so ordering never drifts', () => {
		const item = priced(1, [
			['zebra', 500],
			['alpha', 500]
		]);

		expect(usableQuotes(item).map((entry) => entry.providerId)).toEqual(['alpha', 'zebra']);
	});

	it('filters out anything unusable even when it is cheapest', () => {
		const item = priced(1, [['steam', 700]]);
		item.prices?.quotes.push(quote('csfloat', 1, item.item.variant.itemId, { stale: true }));
		item.prices?.quotes.push(quote('skinport', 0, item.item.variant.itemId));

		expect(usableQuotes(item).map((entry) => entry.providerId)).toEqual(['steam']);
	});

	it('returns nothing for an item whose request failed', () => {
		expect(usableQuotes(failedItem(1))).toEqual([]);
		expect(cheapestQuote(failedItem(1))).toBeUndefined();
	});
});

describe('toPricedKit', () => {
	it('joins prices by the exact variant item id', () => {
		const kit = resolvedKit([1, 2]);
		const prices = new Map<number, SkinMarketPrices | null>([
			[variantFor(1).itemId, priced(1, [['steam', 500]]).prices],
			[variantFor(2).itemId, priced(2, [['steam', 900]]).prices]
		]);

		const result = toPricedKit(kit, prices);

		expect(result.items.map((entry) => entry.item.variant.itemId)).toEqual([
			variantFor(1).itemId,
			variantFor(2).itemId
		]);
		expect(result.items[0].prices?.quotes[0].priceMinor).toBe(500);
	});

	it('keeps the kit identity untouched', () => {
		const kit = resolvedKit([1]);
		const result = toPricedKit(kit, new Map());

		expect(result.slug).toBe(kit.slug);
		expect(result.name).toBe(kit.name);
		expect(result.tags).toEqual(kit.tags);
	});

	it('treats an item the loader said nothing about as an error', () => {
		const result = toPricedKit(resolvedKit([1]), new Map());

		expect(result.items[0].state).toBe('error');
	});

	it('separates "nothing listed" from "could not ask"', () => {
		const kit = resolvedKit([1, 2]);
		const prices = new Map<number, SkinMarketPrices | null>([
			[variantFor(1).itemId, emptyItem(1).prices],
			[variantFor(2).itemId, null]
		]);

		const result = toPricedKit(kit, prices);

		expect(result.items[0].state).toBe('no-quotes');
		expect(result.items[1].state).toBe('error');
	});

	it('treats an item whose only quotes are unusable as having none', () => {
		const kit = resolvedKit([1]);
		const item = priced(1, [['steam', 0]]);

		const result = toPricedKit(kit, new Map([[variantFor(1).itemId, item.prices]]));

		expect(result.items[0].state).toBe('no-quotes');
	});

	it('does not mutate the kit it was given', () => {
		const kit = resolvedKit([1, 2]);
		const snapshot = structuredClone(kit);

		toPricedKit(kit, new Map());

		expect(kit).toEqual(snapshot);
	});
});

describe('isFullyPriced', () => {
	it('is true only when every item has a usable price', () => {
		expect(isFullyPriced([priced(1, [['steam', 100]]), priced(2, [['steam', 200]])])).toBe(true);
		expect(isFullyPriced([priced(1, [['steam', 100]]), emptyItem(2)])).toBe(false);
		expect(isFullyPriced([priced(1, [['steam', 100]]), failedItem(2)])).toBe(false);
	});

	it('is false for an empty kit — there is no total to show', () => {
		expect(isFullyPriced([])).toBe(false);
	});
});

describe('unpricedItems', () => {
	it('lists what is missing, in editorial order', () => {
		const items = [priced(1, [['steam', 100]]), emptyItem(2), failedItem(3)];

		expect(unpricedItems(items).map((entry) => entry.item.skin.name)).toEqual([
			'Finish 2',
			'Finish 3'
		]);
	});
});

describe('kitItemIds', () => {
	it('prices the exact variant the kit names, one id per item', () => {
		expect(kitItemIds(resolvedKit([1, 2, 3]))).toEqual([
			variantFor(1).itemId,
			variantFor(2).itemId,
			variantFor(3).itemId
		]);
	});
});
