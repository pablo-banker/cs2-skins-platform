import { describe, expect, it } from 'vitest';
import { pickRepresentativeVariant, WEAR_PREFERENCE } from './representative-variant';
import type { SkinVariant } from '$lib/types/skin';

function variant(overrides: Partial<SkinVariant> & { itemId: number }): SkinVariant {
	return {
		marketHashName: `Item ${overrides.itemId}`,
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

describe('pickRepresentativeVariant', () => {
	it('prefers the best exterior available', () => {
		const chosen = pickRepresentativeVariant([
			variant({ itemId: 3, wear: 'Battle-Scarred' }),
			variant({ itemId: 1, wear: 'Factory New' }),
			variant({ itemId: 2, wear: 'Field-Tested' })
		]);

		expect(chosen?.wear).toBe('Factory New');
	});

	it('falls through the exterior order when the best is missing', () => {
		// AK-47 | Redline has no Factory New; the card should show Minimal Wear.
		const chosen = pickRepresentativeVariant([
			variant({ itemId: 2, wear: 'Field-Tested' }),
			variant({ itemId: 1, wear: 'Minimal Wear' }),
			variant({ itemId: 3, wear: 'Well-Worn' })
		]);

		expect(chosen?.wear).toBe('Minimal Wear');
	});

	it('avoids StatTrak when an ordinary variant exists, even a worse exterior', () => {
		const chosen = pickRepresentativeVariant([
			variant({ itemId: 1, wear: 'Factory New', statTrak: true }),
			variant({ itemId: 2, wear: 'Battle-Scarred' })
		]);

		expect(chosen?.statTrak).toBe(false);
		expect(chosen?.wear).toBe('Battle-Scarred');
	});

	it('avoids Souvenir when an ordinary variant exists', () => {
		const chosen = pickRepresentativeVariant([
			variant({ itemId: 1, wear: 'Factory New', souvenir: true }),
			variant({ itemId: 2, wear: 'Well-Worn' })
		]);

		expect(chosen?.souvenir).toBe(false);
	});

	it('falls back deterministically when only special variants exist', () => {
		const variants = [
			variant({ itemId: 5, wear: 'Field-Tested', souvenir: true }),
			variant({ itemId: 4, wear: 'Minimal Wear', statTrak: true })
		];

		// StatTrak sorts ahead of Souvenir, so the choice is stable either way.
		expect(pickRepresentativeVariant(variants)?.itemId).toBe(4);
		expect(pickRepresentativeVariant([...variants].reverse())?.itemId).toBe(4);
	});

	it('breaks ties on item id so the same skin always shows the same card', () => {
		const variants = [
			variant({ itemId: 9, wear: 'Factory New' }),
			variant({ itemId: 2, wear: 'Factory New' })
		];

		expect(pickRepresentativeVariant(variants)?.itemId).toBe(2);
		expect(pickRepresentativeVariant([...variants].reverse())?.itemId).toBe(2);
	});

	it('handles variants with no exterior, such as knives without wear', () => {
		const chosen = pickRepresentativeVariant([
			variant({ itemId: 2, wear: 'Factory New' }),
			variant({ itemId: 1 })
		]);

		expect(chosen?.itemId).toBe(1);
	});

	it('returns nothing for an empty set', () => {
		expect(pickRepresentativeVariant([])).toBeUndefined();
	});

	it('does not reorder the caller’s array', () => {
		const variants = [
			variant({ itemId: 3, wear: 'Battle-Scarred' }),
			variant({ itemId: 1, wear: 'Factory New' })
		];
		const before = variants.map((v) => v.itemId);

		pickRepresentativeVariant(variants);

		expect(variants.map((v) => v.itemId)).toEqual(before);
	});

	it('covers every exterior the catalog reports', () => {
		expect(WEAR_PREFERENCE).toEqual([
			'Factory New',
			'Minimal Wear',
			'Field-Tested',
			'Well-Worn',
			'Battle-Scarred'
		]);
	});
});
