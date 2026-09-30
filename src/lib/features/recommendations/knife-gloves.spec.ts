import { describe, expect, it } from 'vitest';
import {
	equipmentSlot,
	knifeGloveMatches,
	oppositeEquipmentSlot,
	GLOVES_SLOT_ID,
	KNIFE_GLOVE_MATCH_LIMIT,
	KNIFE_SLOT_ID
} from './knife-gloves';
import { MIN_VISUAL_SIMILARITY_SCORE } from './visual-similarity';
import type { DiscoverableSkin, SkinVisualProfile } from '$lib/types/visual-metadata';

let nextItemId = 1;

function skin(
	weapon: string,
	name: string,
	visual: SkinVisualProfile | null,
	itemSubtype: string
): DiscoverableSkin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		variants: [
			{
				itemId: nextItemId++,
				marketHashName: `${weapon} | ${name} (Field-Tested)`,
				wear: 'Field-Tested',
				statTrak: false,
				souvenir: false
			}
		],
		visual
	};
}

const knife = (weapon: string, name: string, visual: SkinVisualProfile | null) =>
	skin(weapon, name, visual, 'Knives');
const gloves = (weapon: string, name: string, visual: SkinVisualProfile | null) =>
	skin(weapon, name, visual, 'Gloves');
const rifle = (name: string, visual: SkinVisualProfile | null) =>
	skin('AK-47', name, visual, 'Rifles');

const RED_DARK: SkinVisualProfile = {
	primaryColors: ['red', 'black'],
	secondaryColors: [],
	styles: ['dark']
};
const RED: SkinVisualProfile = { primaryColors: ['red'], secondaryColors: [], styles: [] };
const BLACK: SkinVisualProfile = {
	primaryColors: ['black'],
	secondaryColors: [],
	styles: ['dark']
};
const BLUE: SkinVisualProfile = { primaryColors: ['blue'], secondaryColors: [], styles: [] };
/** Scores 2 against RED_DARK: a trim colour only. */
const RED_TRIM: SkinVisualProfile = {
	primaryColors: ['green'],
	secondaryColors: ['red'],
	styles: []
};

const KNIFE_SOURCE = knife('Karambit', 'Crimson Web', RED_DARK);
const GLOVE_SOURCE = gloves('Specialist Gloves', 'Crimson Web', RED_DARK);

function slugs(items: { slug: string }[]): string[] {
	return items.map((item) => item.slug);
}

describe('recognising the two categories', () => {
	it('names the slot a knife or a pair of gloves belongs to', () => {
		expect(equipmentSlot(KNIFE_SOURCE)).toBe(KNIFE_SLOT_ID);
		expect(equipmentSlot(GLOVE_SOURCE)).toBe(GLOVES_SLOT_ID);
	});

	it('works across families, not base names', () => {
		// The Knife slot holds twenty base names; none of them is special-cased.
		for (const weapon of ['Bayonet', 'M9 Bayonet', 'Talon Knife', 'Butterfly Knife']) {
			expect(equipmentSlot(knife(weapon, 'Night', BLACK)), weapon).toBe(KNIFE_SLOT_ID);
		}
		for (const weapon of ['Sport Gloves', 'Driver Gloves', 'Hand Wraps', 'Moto Gloves']) {
			expect(equipmentSlot(gloves(weapon, 'Slaughter', RED)), weapon).toBe(GLOVES_SLOT_ID);
		}
	});

	it('refuses a firearm', () => {
		expect(equipmentSlot(rifle('Redline', RED_DARK))).toBeUndefined();
	});

	it('pairs each category with the other', () => {
		expect(oppositeEquipmentSlot(KNIFE_SLOT_ID)).toBe(GLOVES_SLOT_ID);
		expect(oppositeEquipmentSlot(GLOVES_SLOT_ID)).toBe(KNIFE_SLOT_ID);
	});
});

describe('matching from a knife', () => {
	it('returns gloves and nothing else', () => {
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Specialist Gloves', 'Crimson Web', RED_DARK),
			knife('M9 Bayonet', 'Crimson Web', RED_DARK),
			rifle('Redline', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['specialist-gloves-crimson-web']);
	});

	it('never recommends another knife, however well it matches', () => {
		// An identical knife scores highest of anything here — and belongs under
		// Similar skins on its own page, not in a pairing tool.
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			knife('M9 Bayonet', 'Crimson Web', RED_DARK),
			gloves('Driver Gloves', 'Crimson Weave', RED)
		]);

		expect(slugs(result)).toEqual(['driver-gloves-crimson-weave']);
	});

	it('never recommends the source itself', () => {
		expect(knifeGloveMatches(KNIFE_SOURCE, [KNIFE_SOURCE])).toEqual([]);
	});

	it('leaves uncurated gloves out', () => {
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Sport Gloves', 'Uncurated', null),
			gloves('Specialist Gloves', 'Crimson Web', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['specialist-gloves-crimson-web']);
	});

	it('returns nothing when the source is uncurated', () => {
		const uncurated = knife('Karambit', 'Doppler', null);

		expect(knifeGloveMatches(uncurated, [gloves('Sport Gloves', 'Red Racer', RED)])).toEqual([]);
	});

	it('applies the shared threshold, not a looser one of its own', () => {
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Sport Gloves', 'Trim', RED_TRIM),
			gloves('Driver Gloves', 'Unrelated', BLUE)
		]);

		expect(result).toEqual([]);
		expect(MIN_VISUAL_SIMILARITY_SCORE).toBe(4);
	});
});

describe('matching from gloves', () => {
	it('returns knives and nothing else', () => {
		const result = knifeGloveMatches(GLOVE_SOURCE, [
			knife('Karambit', 'Crimson Web', RED_DARK),
			gloves('Sport Gloves', 'Scarlet Shamagh', RED_DARK),
			rifle('Redline', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['karambit-crimson-web']);
	});

	it('follows the same rules in reverse', () => {
		const result = knifeGloveMatches(GLOVE_SOURCE, [
			GLOVE_SOURCE,
			knife('Bayonet', 'Uncurated', null),
			knife('Talon Knife', 'Unrelated', BLUE),
			knife('M9 Bayonet', 'Crimson Web', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['m9-bayonet-crimson-web']);
	});
});

describe('ranking and bounds', () => {
	it('puts the strongest match first', () => {
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Driver Gloves', 'Weaker', RED),
			gloves('Specialist Gloves', 'Stronger', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['specialist-gloves-stronger', 'driver-gloves-weaker']);
	});

	it('breaks a tie on the canonical slug, not on input order', () => {
		const forwards = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Sport Gloves', 'Zulu', RED_DARK),
			gloves('Driver Gloves', 'Alpha', RED_DARK)
		]);
		const backwards = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Driver Gloves', 'Alpha', RED_DARK),
			gloves('Sport Gloves', 'Zulu', RED_DARK)
		]);

		expect(slugs(forwards)).toEqual(['driver-gloves-alpha', 'sport-gloves-zulu']);
		expect(slugs(backwards)).toEqual(slugs(forwards));
	});

	it('stops at the limit', () => {
		const candidates = Array.from({ length: 20 }, (_, index) =>
			gloves('Sport Gloves', `Finish ${String(index).padStart(2, '0')}`, RED_DARK)
		);

		expect(knifeGloveMatches(KNIFE_SOURCE, candidates)).toHaveLength(KNIFE_GLOVE_MATCH_LIMIT);
		expect(KNIFE_GLOVE_MATCH_LIMIT).toBe(6);
	});

	it('returns fewer than the limit rather than filler', () => {
		const result = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Specialist Gloves', 'Crimson Web', RED_DARK),
			gloves('Sport Gloves', 'Unrelated', BLUE)
		]);

		expect(result).toHaveLength(1);
	});

	it('does not mutate the candidates', () => {
		const candidates = [
			gloves('Specialist Gloves', 'Crimson Web', RED_DARK),
			gloves('Sport Gloves', 'Red Racer', RED)
		];
		const before = structuredClone(candidates);

		knifeGloveMatches(KNIFE_SOURCE, candidates);

		expect(candidates).toEqual(before);
	});

	it('carries the evidence behind each match', () => {
		const [first] = knifeGloveMatches(KNIFE_SOURCE, [
			gloves('Specialist Gloves', 'Crimson Web', RED_DARK)
		]);

		expect(first.matchedColors).toEqual(['black', 'red']);
		expect(first.matchedStyles).toEqual(['dark']);
		expect(first.slotId).toBe(GLOVES_SLOT_ID);
	});
});
