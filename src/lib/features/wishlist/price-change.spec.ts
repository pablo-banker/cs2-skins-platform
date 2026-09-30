import { describe, expect, it } from 'vitest';
import { priceChangeSinceAdded } from './price-change';

const brl = (amountMinor: number) => ({ amountMinor, currency: 'BRL' });

describe('movement since it was saved', () => {
	it('reports a drop as the amount lower', () => {
		expect(priceChangeSinceAdded(brl(10_000), brl(8000))).toEqual({
			kind: 'lower',
			byMinor: 2000,
			currency: 'BRL'
		});
	});

	it('reports a rise as the amount higher', () => {
		expect(priceChangeSinceAdded(brl(10_000), brl(12_000))).toEqual({
			kind: 'higher',
			byMinor: 2000,
			currency: 'BRL'
		});
	});

	it('reports no change', () => {
		expect(priceChangeSinceAdded(brl(10_000), brl(10_000))).toEqual({
			kind: 'unchanged',
			currency: 'BRL'
		});
	});

	it('is exact to the cent', () => {
		expect(priceChangeSinceAdded(brl(15_300), brl(13_006))).toMatchObject({ byMinor: 2294 });
		expect(priceChangeSinceAdded(brl(1), brl(2))).toMatchObject({ kind: 'higher', byMinor: 1 });
	});

	it('never goes through a float', () => {
		// 0.1 + 0.2 territory: integers in, integers out, nothing multiplied.
		const change = priceChangeSinceAdded(brl(1029), brl(1000));

		expect(change).toMatchObject({ kind: 'lower', byMinor: 29 });
		expect(Number.isInteger(change && 'byMinor' in change ? change.byMinor : 0)).toBe(true);
	});
});

describe('when there is nothing to compare', () => {
	it('says nothing without a baseline', () => {
		// Saved while the market was quiet. Showing the current price alone is
		// the honest answer.
		expect(priceChangeSinceAdded(undefined, brl(10_000))).toBeUndefined();
	});

	it('says nothing without a current price', () => {
		expect(priceChangeSinceAdded(brl(10_000), undefined)).toBeUndefined();
	});

	it('says nothing with neither', () => {
		expect(priceChangeSinceAdded(undefined, undefined)).toBeUndefined();
	});

	it('refuses to compare two currencies', () => {
		// There is no FX anywhere in this product, and a confident wrong
		// number is worse than none.
		expect(
			priceChangeSinceAdded(
				{ amountMinor: 10_000, currency: 'BRL' },
				{ amountMinor: 2000, currency: 'USD' }
			)
		).toBeUndefined();
	});
});

describe('what it is not', () => {
	it('never speaks in portfolio terms', () => {
		const shapes = [
			priceChangeSinceAdded(brl(10_000), brl(8000)),
			priceChangeSinceAdded(brl(8000), brl(10_000)),
			priceChangeSinceAdded(brl(10_000), brl(10_000))
		];

		// A wishlist is things someone might buy. Nothing here is a profit, a
		// loss, a return or a percentage.
		for (const shape of shapes) {
			expect(Object.keys(shape ?? {})).not.toContain('percent');
			expect(JSON.stringify(shape)).not.toMatch(/profit|loss|return|gain|roi/i);
		}
	});
});
