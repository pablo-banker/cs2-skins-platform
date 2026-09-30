import { describe, expect, it } from 'vitest';
import { matchingSkins, similarSkins, MATCH_LIMIT, SIMILAR_LIMIT } from './skin-recommendations';
import { MIN_VISUAL_SIMILARITY_SCORE, VISUAL_SIMILARITY_WEIGHTS } from './visual-similarity';
import type { DiscoverableSkin, SkinVisualProfile } from '$lib/types/visual-metadata';

let nextItemId = 1;

/** A catalog skin with curation attached, as the service hands them over. */
function skin(
	weapon: string,
	name: string,
	visual: SkinVisualProfile | null,
	itemSubtype = 'Rifles'
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
				marketHashName: `${weapon} | ${name} (Factory New)`,
				wear: 'Factory New',
				statTrak: false,
				souvenir: false
			},
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

const RED: SkinVisualProfile = { primaryColors: ['red'], secondaryColors: [], styles: [] };
const RED_DARK: SkinVisualProfile = {
	primaryColors: ['red'],
	secondaryColors: ['black'],
	styles: ['dark']
};
const RED_TRIM: SkinVisualProfile = {
	primaryColors: ['gray'],
	secondaryColors: ['red'],
	styles: []
};
const BLUE: SkinVisualProfile = { primaryColors: ['blue'], secondaryColors: [], styles: [] };
const DARK_ONLY: SkinVisualProfile = {
	primaryColors: ['blue'],
	secondaryColors: [],
	styles: ['dark']
};

const SOURCE = skin('AK-47', 'Redline', RED_DARK);

function slugs(items: { slug: string }[]): string[] {
	return items.map((item) => item.slug);
}

describe('similar skins', () => {
	it('never recommends the skin someone is already looking at', () => {
		const result = similarSkins(SOURCE, [SOURCE, skin('AK-47', 'Bloodsport', RED)]);

		expect(slugs(result)).toEqual(['ak-47-bloodsport']);
	});

	it('stays in the same slot', () => {
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Bloodsport', RED),
			skin('AWP', 'Wildfire', RED, 'Rifles'),
			skin('USP-S', 'Check Engine', RED, 'Pistols')
		]);

		expect(slugs(result)).toEqual(['ak-47-bloodsport']);
	});

	it('requires verified overlap, never a fallback', () => {
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Blue Laminate', BLUE),
			skin('AK-47', 'Frontside Misty', BLUE)
		]);

		expect(result).toEqual([]);
	});

	it('leaves uncurated candidates out', () => {
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Uncurated', null),
			skin('AK-47', 'Bloodsport', RED)
		]);

		expect(slugs(result)).toEqual(['ak-47-bloodsport']);
	});

	it('recommends nothing when the source itself is uncurated', () => {
		const uncurated = skin('AK-47', 'Nightwish', null);

		expect(similarSkins(uncurated, [skin('AK-47', 'Bloodsport', RED)])).toEqual([]);
	});

	it('ranks a stronger overlap first', () => {
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Colour Only', RED),
			skin('AK-47', 'Colour And Style', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['ak-47-colour-and-style', 'ak-47-colour-only']);
	});

	it('drops a candidate whose only link is a trim colour', () => {
		// Score 2: the source's main red meeting the candidate's trim red. Two
		// skins with some red on them are not "similar".
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Trim', RED_TRIM),
			skin('AK-47', 'Defining', RED)
		]);

		expect(slugs(result)).toEqual(['ak-47-defining']);
	});

	it('counts a shared style toward the ranking', () => {
		const withStyle = skin('AK-47', 'Red Dark', RED_DARK);
		const withoutStyle = skin('AK-47', 'Red Plain', RED);

		const result = similarSkins(SOURCE, [withoutStyle, withStyle]);

		expect(slugs(result)).toEqual(['ak-47-red-dark', 'ak-47-red-plain']);
	});

	it('breaks a tie on the canonical slug, not on input order', () => {
		const forwards = similarSkins(SOURCE, [
			skin('AK-47', 'Zulu', RED),
			skin('AK-47', 'Alpha', RED)
		]);
		const backwards = similarSkins(SOURCE, [
			skin('AK-47', 'Alpha', RED),
			skin('AK-47', 'Zulu', RED)
		]);

		expect(slugs(forwards)).toEqual(['ak-47-alpha', 'ak-47-zulu']);
		expect(slugs(backwards)).toEqual(slugs(forwards));
	});

	it('shows four at most', () => {
		const candidates = Array.from({ length: 12 }, (_, index) =>
			skin('AK-47', `Finish ${String(index).padStart(2, '0')}`, RED)
		);

		expect(similarSkins(SOURCE, candidates)).toHaveLength(SIMILAR_LIMIT);
		expect(SIMILAR_LIMIT).toBe(4);
	});

	it('carries a representative variant for the card', () => {
		const [first] = similarSkins(SOURCE, [skin('AK-47', 'Bloodsport', RED)]);

		// The plain, best-condition variant — the same one the skin page will
		// default to when the link is followed.
		expect(first.variant.wear).toBe('Factory New');
		expect(first.variant.statTrak).toBe(false);
	});

	it('does not mutate the candidates', () => {
		const candidates = [skin('AK-47', 'Bloodsport', RED), skin('AK-47', 'Blue Laminate', BLUE)];
		const before = structuredClone(candidates);

		similarSkins(SOURCE, candidates);

		expect(candidates).toEqual(before);
	});
});

describe('matches this skin', () => {
	const CROSS_SLOT = [
		skin('USP-S', 'Check Engine', RED, 'Pistols'),
		skin('AWP', 'Wildfire', RED, 'Rifles'),
		skin('Desert Eagle', 'Code Red', RED, 'Pistols'),
		skin('Karambit', 'Crimson Web', RED_DARK, 'Knives'),
		skin('Sport Gloves', 'Red Racer', RED, 'Gloves')
	];

	it('never recommends the source', () => {
		expect(slugs(matchingSkins(SOURCE, [SOURCE, ...CROSS_SLOT]))).not.toContain('ak-47-redline');
	});

	it('leaves the source slot out entirely — that is the other section', () => {
		const result = matchingSkins(SOURCE, [
			skin('AK-47', 'Bloodsport', RED),
			skin('AK-47', 'Red Laminate', RED),
			...CROSS_SLOT
		]);

		expect(slugs(result).some((slug) => slug.startsWith('ak-47-'))).toBe(false);
	});

	it('spreads across slots rather than stacking one weapon', () => {
		// Eight USP-S finishes outscore everything else here, so a plain top-six
		// would have returned six pistols from one slot.
		const result = matchingSkins(SOURCE, [
			...Array.from({ length: 8 }, (_, index) =>
				skin('USP-S', `Red ${String(index).padStart(2, '0')}`, RED_DARK, 'Pistols')
			),
			...CROSS_SLOT
		]);

		const slotIds = result.map((item) => item.slotId);

		// Five slots are available; every one of them is used before any slot
		// is used twice.
		expect(new Set(slotIds.slice(0, 5)).size).toBe(5);
		expect(slotIds.filter((id) => id === 'usp-s')).toHaveLength(2);
	});

	it('takes the best of each slot, not merely the first', () => {
		const result = matchingSkins(SOURCE, [
			skin('USP-S', 'Trim', RED_TRIM, 'Pistols'),
			skin('USP-S', 'Defining', RED_DARK, 'Pistols')
		]);

		// Both are the same slot, so the second only arrives through the depth
		// pass — but the slot's turn is spent on the stronger match.
		expect(slugs(result)[0]).toBe('usp-s-defining');
	});

	it('allows a second from a slot only once every slot has had a turn', () => {
		const result = matchingSkins(SOURCE, [
			skin('USP-S', 'Red One', RED, 'Pistols'),
			skin('USP-S', 'Red Two', RED, 'Pistols'),
			skin('AWP', 'Wildfire', RED, 'Rifles')
		]);

		// Three positive matches across two slots: breadth first, then depth.
		expect(slugs(result)).toEqual(['awp-wildfire', 'usp-s-red-one', 'usp-s-red-two']);
	});

	it('requires verified overlap, never filler', () => {
		const result = matchingSkins(SOURCE, [
			skin('USP-S', 'Blueprint', BLUE, 'Pistols'),
			skin('AWP', 'Corticera', BLUE, 'Rifles')
		]);

		expect(result).toEqual([]);
	});

	it('shows fewer than six when fewer exist', () => {
		const result = matchingSkins(SOURCE, [
			skin('USP-S', 'Check Engine', RED, 'Pistols'),
			skin('AWP', 'Wildfire', RED, 'Rifles')
		]);

		expect(result).toHaveLength(2);
	});

	it('shows six at most', () => {
		const candidates = [
			...CROSS_SLOT,
			skin('M4A1-S', 'Hot Rod', RED, 'Rifles'),
			skin('Glock-18', 'Candy Apple', RED, 'Pistols'),
			skin('P250', 'Muertos', RED, 'Pistols'),
			skin('Tec-9', 'Red Quartz', RED, 'Pistols')
		];

		expect(matchingSkins(SOURCE, candidates)).toHaveLength(MATCH_LIMIT);
		expect(MATCH_LIMIT).toBe(6);
	});

	it('recommends nothing when the source is uncurated', () => {
		expect(matchingSkins(skin('AK-47', 'Nightwish', null), CROSS_SLOT)).toEqual([]);
	});

	it('leaves uncurated candidates out', () => {
		const result = matchingSkins(SOURCE, [skin('USP-S', 'Uncurated', null, 'Pistols')]);

		expect(result).toEqual([]);
	});

	it('is deterministic whatever order the catalog arrives in', () => {
		const forwards = matchingSkins(SOURCE, CROSS_SLOT);
		const backwards = matchingSkins(SOURCE, [...CROSS_SLOT].reverse());

		expect(slugs(backwards)).toEqual(slugs(forwards));
	});

	it('does not mutate the candidates', () => {
		const candidates = structuredClone(CROSS_SLOT);
		const before = structuredClone(candidates);

		matchingSkins(SOURCE, candidates);

		expect(candidates).toEqual(before);
	});
});

describe('knives and gloves, through slot identity alone', () => {
	const KNIFE_SOURCE = skin('Karambit', 'Crimson Web', RED_DARK, 'Knives');
	const GLOVE_SOURCE = skin('Sport Gloves', 'Red Racer', RED, 'Gloves');

	it('recommends other knife families beside a knife', () => {
		// The Knife slot is one family, not one base name — nobody equips a
		// Karambit and a Bayonet, so a Bayonet is the alternative.
		const result = similarSkins(KNIFE_SOURCE, [
			skin('M9 Bayonet', 'Crimson Web', RED_DARK, 'Knives'),
			skin('Talon Knife', 'Crimson Web', RED_DARK, 'Knives'),
			skin('AK-47', 'Redline', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['m9-bayonet-crimson-web', 'talon-knife-crimson-web']);
	});

	it('pairs a knife with gloves and guns', () => {
		const result = matchingSkins(KNIFE_SOURCE, [
			skin('Sport Gloves', 'Scarlet Shamagh', RED_DARK, 'Gloves'),
			skin('AK-47', 'Redline', RED_DARK),
			skin('M9 Bayonet', 'Crimson Web', RED_DARK, 'Knives')
		]);

		// One knife, and it is not the one being looked at.
		expect(new Set(result.map((item) => item.slotId))).toEqual(new Set(['gloves', 'ak-47']));
	});

	it('recommends other glove families beside gloves', () => {
		const result = similarSkins(GLOVE_SOURCE, [
			skin('Driver Gloves', 'Crimson Weave', RED, 'Gloves'),
			skin('Hand Wraps', 'Slaughter', RED, 'Gloves')
		]);

		expect(slugs(result)).toEqual(['driver-gloves-crimson-weave', 'hand-wraps-slaughter']);
	});

	it('pairs gloves with a knife and guns', () => {
		const result = matchingSkins(GLOVE_SOURCE, [
			skin('Karambit', 'Slaughter', RED, 'Knives'),
			skin('AWP', 'Wildfire', RED),
			skin('Driver Gloves', 'Crimson Weave', RED, 'Gloves')
		]);

		expect(new Set(result.map((item) => item.slotId))).toEqual(new Set(['knife', 'awp']));
	});
});

describe('what cannot be recommended', () => {
	it('skips a skin no Builder slot accepts', () => {
		// An upstream base name the registry has never been told about.
		const unknown = skin('Trench Shovel', 'Rust Coat', RED, 'Melee');

		expect(similarSkins(SOURCE, [unknown])).toEqual([]);
		expect(matchingSkins(SOURCE, [unknown])).toEqual([]);
	});

	it('recommends nothing for a source no slot accepts', () => {
		const unknown = skin('Trench Shovel', 'Rust Coat', RED, 'Melee');

		expect(similarSkins(unknown, [skin('AK-47', 'Redline', RED)])).toEqual([]);
	});

	it('does not treat a shared style alone as a match', () => {
		// `dark` is shared, red is not. Score 2 — real overlap, but not enough
		// to put a blue glove beside a red knife and call it a pairing.
		const result = matchingSkins(SOURCE, [skin('USP-S', 'Night Ops', DARK_ONLY, 'Pistols')]);

		expect(result).toEqual([]);
	});
});

describe('the similarity threshold', () => {
	const W = VISUAL_SIMILARITY_WEIGHTS;

	/** A profile built to score exactly `n` against a red, black, dark source. */
	const scoring: [number, SkinVisualProfile][] = [
		// Nothing in common.
		[0, { primaryColors: ['green'], secondaryColors: [], styles: ['military'] }],
		// Two trim colours meeting: 1.
		[W.secondaryToSecondary, { primaryColors: ['green'], secondaryColors: ['black'], styles: [] }],
		// One shared style: 2.
		[W.sharedStyle, { primaryColors: ['green'], secondaryColors: [], styles: ['dark'] }],
		// A trim pairing plus a shared style: 3.
		[
			W.secondaryToSecondary + W.sharedStyle,
			{ primaryColors: ['green'], secondaryColors: ['black'], styles: ['dark'] }
		],
		// One colour defining both skins: 4.
		[W.primaryToPrimary, { primaryColors: ['red'], secondaryColors: [], styles: [] }]
	];

	it('is one colour that defines both skins', () => {
		expect(MIN_VISUAL_SIMILARITY_SCORE).toBe(VISUAL_SIMILARITY_WEIGHTS.primaryToPrimary);
	});

	it.each(scoring)('a score of %i is %s', (score, visual) => {
		// SOURCE is red + black, dark. Each profile above is constructed to hit
		// exactly `score` against it.
		const included = score >= MIN_VISUAL_SIMILARITY_SCORE;

		const same = similarSkins(SOURCE, [skin('AK-47', `Scores ${score}`, visual)]);
		const cross = matchingSkins(SOURCE, [skin('USP-S', `Scores ${score}`, visual, 'Pistols')]);

		expect(same.length, `similar at ${score}`).toBe(included ? 1 : 0);
		expect(cross.length, `matches at ${score}`).toBe(included ? 1 : 0);
	});

	it('accepts a weak colour pairing once a style joins it', () => {
		// 2 + 2: the source's main red on the candidate's trim, plus `dark`.
		// Not one strong colour, but two independent verified signals.
		const combined: SkinVisualProfile = {
			primaryColors: ['green'],
			secondaryColors: ['red'],
			styles: ['dark']
		};

		expect(slugs(similarSkins(SOURCE, [skin('AK-47', 'Combined', combined)]))).toEqual([
			'ak-47-combined'
		]);
	});

	it('still ranks by strength above the threshold', () => {
		const result = similarSkins(SOURCE, [
			skin('AK-47', 'Just Clears', RED),
			skin('AK-47', 'Strong', RED_DARK)
		]);

		expect(slugs(result)).toEqual(['ak-47-strong', 'ak-47-just-clears']);
	});

	it('returns nothing rather than lowering the bar to fill the grid', () => {
		// Four candidates, none of them strong enough. An empty section is a
		// curation signal, not a layout problem to solve with filler.
		const weak = Array.from({ length: 4 }, (_, index) => skin('AK-47', `Weak ${index}`, DARK_ONLY));

		expect(similarSkins(SOURCE, weak)).toEqual([]);
	});
});
