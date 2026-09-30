import { describe, expect, it } from 'vitest';
import { pickPracticalVariant, PRACTICAL_WEAR_PREFERENCE } from './practical-variant';
import type { VariantChoice } from '$lib/features/skins/variant-selection';

function variant(itemId: number, overrides: Partial<VariantChoice> = {}): VariantChoice {
	return { itemId, wear: 'Field-Tested', statTrak: false, souvenir: false, ...overrides };
}

function skin(...variants: VariantChoice[]) {
	return { variants };
}

describe('edition', () => {
	it('prefers the normal edition over StatTrak', () => {
		const picked = pickPracticalVariant(skin(variant(2, { statTrak: true }), variant(1)));

		expect(picked?.itemId).toBe(1);
	});

	it('prefers the normal edition over Souvenir', () => {
		const picked = pickPracticalVariant(skin(variant(2, { souvenir: true }), variant(1)));

		expect(picked?.itemId).toBe(1);
	});

	it('refuses a skin sold only as StatTrak', () => {
		// A premium edition is a choice someone makes on purpose, not something
		// to generate into a budget loadout.
		expect(pickPracticalVariant(skin(variant(1, { statTrak: true })))).toBeUndefined();
	});

	it('refuses a skin sold only as Souvenir', () => {
		expect(pickPracticalVariant(skin(variant(1, { souvenir: true })))).toBeUndefined();
	});

	it('refuses a skin with no variants at all', () => {
		expect(pickPracticalVariant(skin())).toBeUndefined();
	});
});

describe('exterior', () => {
	it('prefers Field-Tested when it exists', () => {
		const picked = pickPracticalVariant(
			skin(
				variant(1, { wear: 'Factory New' }),
				variant(2, { wear: 'Battle-Scarred' }),
				variant(3, { wear: 'Field-Tested' })
			)
		);

		expect(picked?.wear).toBe('Field-Tested');
	});

	it('falls back down the preference in order', () => {
		const fallbacks: [string[], string][] = [
			[['Minimal Wear', 'Well-Worn', 'Factory New', 'Battle-Scarred'], 'Minimal Wear'],
			[['Well-Worn', 'Factory New', 'Battle-Scarred'], 'Well-Worn'],
			[['Factory New', 'Battle-Scarred'], 'Factory New'],
			[['Battle-Scarred'], 'Battle-Scarred']
		];

		for (const [available, expected] of fallbacks) {
			const picked = pickPracticalVariant(
				skin(...available.map((wear, index) => variant(index + 1, { wear })))
			);

			expect(picked?.wear, available.join(',')).toBe(expected);
		}
	});

	it('takes Battle-Scarred last despite it usually being cheapest', () => {
		// A generator that reached for the worst condition first would fit more
		// budgets and produce loadouts nobody wants.
		const picked = pickPracticalVariant(
			skin(variant(1, { wear: 'Battle-Scarred' }), variant(2, { wear: 'Factory New' }))
		);

		expect(picked?.wear).toBe('Factory New');
	});

	it('handles an exterior outside the preference without dropping the skin', () => {
		const picked = pickPracticalVariant(skin(variant(7, { wear: 'Not Painted' })));

		expect(picked?.itemId).toBe(7);
	});

	it('handles a finish-less product, inventing no exterior', () => {
		const picked = pickPracticalVariant(skin(variant(9, { wear: undefined })));

		expect(picked?.itemId).toBe(9);
		expect(picked?.wear).toBeUndefined();
	});
});

describe('determinism', () => {
	it('breaks an exterior tie on catalog id', () => {
		const picked = pickPracticalVariant(
			skin(variant(20, { wear: 'Field-Tested' }), variant(10, { wear: 'Field-Tested' }))
		);

		expect(picked?.itemId).toBe(10);
	});

	it('returns the same variant however the list was ordered', () => {
		const variants = [
			variant(3, { wear: 'Factory New' }),
			variant(1, { wear: 'Field-Tested' }),
			variant(2, { wear: 'Minimal Wear' })
		];

		const forwards = pickPracticalVariant(skin(...variants));
		const backwards = pickPracticalVariant(skin(...[...variants].reverse()));

		expect(backwards?.itemId).toBe(forwards?.itemId);
	});

	it('does not mutate the skin it was given', () => {
		const variants = [variant(3, { wear: 'Factory New' }), variant(1)];
		const snapshot = structuredClone(variants);

		pickPracticalVariant({ variants });

		expect(variants).toEqual(snapshot);
	});
});

describe('the preference itself', () => {
	it('starts at a practical exterior rather than a collector one', () => {
		expect(PRACTICAL_WEAR_PREFERENCE[0]).toBe('Field-Tested');
		expect(PRACTICAL_WEAR_PREFERENCE.at(-1)).toBe('Battle-Scarred');
	});
});
