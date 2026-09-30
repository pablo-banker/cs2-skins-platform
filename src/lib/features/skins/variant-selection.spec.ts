import { describe, expect, it } from 'vitest';
import {
	availableEditions,
	availablePhases,
	availableWears,
	orderedVariants,
	resolveVariant,
	skinVariantSearch,
	variantEdition
} from './variant-selection';
import { parseSkinSelection } from '$lib/schemas/skin-detail';
import type { Skin, SkinVariant } from '$lib/types/skin';

let nextId = 1;

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	const itemId = overrides.itemId ?? nextId++;

	return {
		itemId,
		marketHashName: `item-${itemId}`,
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

function skin(variants: SkinVariant[], overrides: Partial<Skin> = {}): Skin {
	return {
		id: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		variants,
		...overrides
	};
}

/** AK-47 | Redline: no Factory New, plus StatTrak and Souvenir lines. */
const redline = skin([
	variant({ itemId: 10, wear: 'Minimal Wear' }),
	variant({ itemId: 11, wear: 'Field-Tested' }),
	variant({ itemId: 12, wear: 'Battle-Scarred' }),
	variant({ itemId: 20, wear: 'Minimal Wear', statTrak: true }),
	variant({ itemId: 21, wear: 'Field-Tested', statTrak: true }),
	variant({ itemId: 30, wear: 'Field-Tested', souvenir: true })
]);

const onlyNormal = skin([
	variant({ itemId: 40, wear: 'Factory New' }),
	variant({ itemId: 41, wear: 'Minimal Wear' })
]);

const doppler = skin(
	[
		variant({ itemId: 50, wear: 'Factory New', phase: 'Phase 1' }),
		variant({ itemId: 51, wear: 'Factory New', phase: 'Phase 2' }),
		variant({ itemId: 52, wear: 'Minimal Wear', phase: 'Phase 2' }),
		variant({ itemId: 53, wear: 'Factory New', phase: 'Ruby' })
	],
	{ id: 'karambit-doppler', weapon: '★ Karambit', name: 'Doppler' }
);

describe('variantEdition', () => {
	it('classifies each finish', () => {
		expect(variantEdition(variant())).toBe('normal');
		expect(variantEdition(variant({ statTrak: true }))).toBe('stattrak');
		expect(variantEdition(variant({ souvenir: true }))).toBe('souvenir');
	});
});

describe('resolveVariant defaults', () => {
	it('prefers a plain variant in the best available condition', () => {
		const chosen = resolveVariant(redline);

		// Redline has no Factory New, so Minimal Wear is the best on offer.
		expect(chosen?.itemId).toBe(10);
		expect(chosen?.statTrak).toBe(false);
	});

	it('never picks StatTrak or Souvenir by accident', () => {
		const stattrakFirst = skin([
			variant({ itemId: 60, wear: 'Factory New', statTrak: true }),
			variant({ itemId: 61, wear: 'Battle-Scarred' })
		]);

		expect(resolveVariant(stattrakFirst)?.itemId).toBe(61);
	});

	it('is deterministic whatever order the variants arrive in', () => {
		const forward = resolveVariant(redline)?.itemId;
		const reversed = resolveVariant(skin([...redline.variants].reverse()))?.itemId;

		expect(forward).toBe(reversed);
	});

	it('returns nothing only when there is nothing to return', () => {
		expect(resolveVariant(skin([]))).toBeUndefined();
	});

	it('does not reorder the skin it was given', () => {
		const order = redline.variants.map((v) => v.itemId);
		resolveVariant(redline, { wear: 'Field-Tested' });

		expect(redline.variants.map((v) => v.itemId)).toEqual(order);
	});
});

describe('resolveVariant selections', () => {
	it('honours an exterior', () => {
		expect(resolveVariant(redline, { wear: 'Field-Tested' })?.itemId).toBe(11);
	});

	it('honours an edition', () => {
		expect(resolveVariant(redline, { edition: 'stattrak' })?.itemId).toBe(20);
		expect(resolveVariant(redline, { edition: 'souvenir' })?.itemId).toBe(30);
	});

	it('honours an exterior and edition together', () => {
		expect(resolveVariant(redline, { wear: 'Field-Tested', edition: 'stattrak' })?.itemId).toBe(21);
	});

	it('honours a phase', () => {
		expect(resolveVariant(doppler, { phase: 'Ruby' })?.itemId).toBe(53);
		expect(resolveVariant(doppler, { wear: 'Minimal Wear', phase: 'Phase 2' })?.itemId).toBe(52);
	});

	it('falls back through the constraints rather than giving up', () => {
		// StatTrak Battle-Scarred does not exist; the edition matters more than
		// the exterior, so it lands on a StatTrak variant.
		const chosen = resolveVariant(redline, { wear: 'Battle-Scarred', edition: 'stattrak' });

		expect(chosen?.statTrak).toBe(true);
		expect(chosen?.itemId).toBe(20);
	});

	it('ignores an exterior the skin does not have', () => {
		const chosen = resolveVariant(redline, { wear: 'Factory New' });

		expect(chosen?.itemId).toBe(10);
	});

	it('always returns a variant belonging to this skin', () => {
		const ids = new Set(redline.variants.map((v) => v.itemId));

		for (const selection of [
			{ wear: 'Nonsense' },
			{ edition: 'souvenir' as const, wear: 'Factory New' },
			{ phase: 'Phase 9' }
		]) {
			expect(ids.has(resolveVariant(redline, selection)!.itemId)).toBe(true);
		}
	});
});

describe('available options', () => {
	it('lists exteriors in condition order, for the chosen edition', () => {
		expect(availableWears(redline)).toEqual(['Minimal Wear', 'Field-Tested', 'Battle-Scarred']);
		expect(availableWears(redline, 'souvenir')).toEqual(['Field-Tested']);
	});

	it('lists editions plain-first, and only those that exist', () => {
		expect(availableEditions(redline)).toEqual(['normal', 'stattrak', 'souvenir']);
		expect(availableEditions(onlyNormal)).toEqual(['normal']);
	});

	it('lists phases only for phased finishes', () => {
		expect(availablePhases(doppler)).toEqual(['Phase 1', 'Phase 2', 'Ruby']);
		expect(availablePhases(redline)).toEqual([]);
	});

	it('orders variants plain-first, best condition first', () => {
		expect(orderedVariants(redline).map((v) => v.itemId)).toEqual([10, 11, 12, 20, 21, 30]);
	});
});

describe('skinVariantSearch', () => {
	/** Parses a search string back the way the route would. */
	const roundTrip = (target: Skin, search: string) =>
		resolveVariant(target, parseSkinSelection(new URLSearchParams(search)));

	it('produces no query for the default variant, keeping the product URL clean', () => {
		expect(skinVariantSearch(redline, {})).toBe('');
		expect(skinVariantSearch(redline, { wear: 'Minimal Wear', edition: 'normal' })).toBe('');
	});

	it('describes a selection in our own vocabulary, not upstream identifiers', () => {
		const search = skinVariantSearch(redline, { wear: 'Field-Tested', edition: 'stattrak' });

		expect(search).toContain('wear=Field-Tested');
		expect(search).toContain('edition=stattrak');
		expect(search).not.toMatch(/item|21|hash/);
	});

	it('round-trips: the URL it builds resolves back to the same variant', () => {
		for (const selection of [
			{ wear: 'Field-Tested' },
			{ edition: 'stattrak' as const },
			{ wear: 'Field-Tested', edition: 'stattrak' as const },
			{ edition: 'souvenir' as const },
			{ wear: 'Battle-Scarred' }
		]) {
			const expected = resolveVariant(redline, selection)!;
			const search = skinVariantSearch(redline, selection);

			expect(roundTrip(redline, search)?.itemId, JSON.stringify(selection)).toBe(expected.itemId);
		}
	});

	it('round-trips a phased selection', () => {
		const search = skinVariantSearch(doppler, { wear: 'Minimal Wear', phase: 'Phase 2' });

		expect(roundTrip(doppler, search)?.itemId).toBe(52);
	});
});
