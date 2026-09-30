import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	enrichSkin,
	enrichSkins,
	filterByColors,
	filterByStyles,
	filterByVisual,
	matchesColors,
	rankByVisualMatch,
	visualMatchScore
} from './discovery';
import type { Skin } from '$lib/types/skin';
import type { SkinVisualProfile } from '$lib/types/visual-metadata';

// The production dataset is intentionally empty, so enrichment is tested
// against controlled fictional curation rather than claims about real skins.
vi.mock('./visual-metadata', () => ({ getVisualProfile: vi.fn() }));

const { getVisualProfile } = await import('./visual-metadata');

function skin(weapon: string, name: string): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase(),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		variants: []
	};
}

function profile(overrides: Partial<SkinVisualProfile> = {}): SkinVisualProfile {
	return { primaryColors: [], secondaryColors: [], styles: [], ...overrides };
}

/** Test Skin A: red over black, dark. */
const skinA = skin('Test Weapon', 'Alpha');
const profileA = profile({
	primaryColors: ['red'],
	secondaryColors: ['black'],
	styles: ['dark']
});

/** Test Skin B: blue, clean and minimal. */
const skinB = skin('Test Weapon', 'Bravo');
const profileB = profile({ primaryColors: ['blue'], styles: ['clean', 'minimal'] });

/** Test Skin C: uncurated. */
const skinC = skin('Test Weapon', 'Charlie');

const curated = new Map<string, SkinVisualProfile>([
	[skinA.name, profileA],
	[skinB.name, profileB]
]);

/**
 * Applied at module scope as well as per test: some suites enrich their
 * fixtures while the file is being evaluated, which happens before any
 * `beforeEach` has run.
 */
function applyCuration() {
	vi.mocked(getVisualProfile).mockImplementation(
		(_weapon: string, name: string) => curated.get(name) ?? null
	);
}

applyCuration();

beforeEach(() => {
	vi.mocked(getVisualProfile).mockReset();
	applyCuration();
});

describe('enrichSkin', () => {
	it('attaches the curated profile to a known skin', () => {
		expect(enrichSkin(skinA)).toMatchObject({
			fullName: 'Test Weapon | Alpha',
			visual: { primaryColors: ['red'], secondaryColors: ['black'], styles: ['dark'] }
		});
	});

	it('keeps an uncurated skin, with visual null', () => {
		const enriched = enrichSkin(skinC);

		expect(enriched.visual).toBeNull();
		expect(enriched.fullName).toBe('Test Weapon | Charlie');
	});

	it('never drops a skin merely because nobody has curated it yet', () => {
		const enriched = enrichSkins([skinA, skinB, skinC]);

		expect(enriched).toHaveLength(3);
		expect(enriched.filter((entry) => entry.visual === null)).toHaveLength(1);
	});

	it('does not mutate the skin it was given', () => {
		const original = skin('Test Weapon', 'Alpha');
		enrichSkin(original);

		expect(original).not.toHaveProperty('visual');
	});
});

describe('filterByColors', () => {
	const skins = [enrichSkin(skinA), enrichSkin(skinB), enrichSkin(skinC)];

	it('matches on primary colours', () => {
		expect(filterByColors(skins, ['red']).map((s) => s.name)).toEqual(['Alpha']);
	});

	it('matches on secondary colours by default', () => {
		expect(filterByColors(skins, ['black']).map((s) => s.name)).toEqual(['Alpha']);
	});

	it('can be restricted to primary colours only', () => {
		expect(filterByColors(skins, ['black'], { scope: 'primary' })).toEqual([]);
		expect(filterByColors(skins, ['red'], { scope: 'primary' }).map((s) => s.name)).toEqual([
			'Alpha'
		]);
	});

	it('matches ANY selected colour by default', () => {
		expect(filterByColors(skins, ['red', 'blue']).map((s) => s.name)).toEqual(['Alpha', 'Bravo']);
	});

	it('can require ALL selected colours', () => {
		expect(filterByColors(skins, ['red', 'black'], { mode: 'all' }).map((s) => s.name)).toEqual([
			'Alpha'
		]);
		expect(filterByColors(skins, ['red', 'blue'], { mode: 'all' })).toEqual([]);
	});

	it('excludes uncurated skins once a colour filter is applied', () => {
		expect(filterByColors(skins, ['red']).map((s) => s.name)).not.toContain('Charlie');
	});

	it('returns everything when nothing is selected', () => {
		expect(filterByColors(skins, [])).toHaveLength(3);
	});
});

describe('filterByStyles', () => {
	const skins = [enrichSkin(skinA), enrichSkin(skinB), enrichSkin(skinC)];

	it('matches a controlled style tag', () => {
		expect(filterByStyles(skins, ['dark']).map((s) => s.name)).toEqual(['Alpha']);
	});

	it('matches ANY selected style by default and can require ALL', () => {
		expect(filterByStyles(skins, ['dark', 'clean']).map((s) => s.name)).toEqual(['Alpha', 'Bravo']);
		expect(filterByStyles(skins, ['clean', 'minimal'], { mode: 'all' }).map((s) => s.name)).toEqual(
			['Bravo']
		);
		expect(filterByStyles(skins, ['clean', 'dark'], { mode: 'all' })).toEqual([]);
	});

	it('returns everything when nothing is selected', () => {
		expect(filterByStyles(skins, [])).toHaveLength(3);
	});
});

describe('filterByVisual', () => {
	const skins = [enrichSkin(skinA), enrichSkin(skinB), enrichSkin(skinC)];

	it('returns everything, uncurated included, when no criteria are given', () => {
		expect(filterByVisual(skins)).toHaveLength(3);
		expect(filterByVisual(skins, {})).toHaveLength(3);
	});

	it('combines colour and style criteria with AND', () => {
		expect(filterByVisual(skins, { colors: ['red'], styles: ['dark'] }).map((s) => s.name)).toEqual(
			['Alpha']
		);
		expect(filterByVisual(skins, { colors: ['red'], styles: ['clean'] })).toEqual([]);
	});

	it('honours the colour scope and mode options together', () => {
		expect(filterByVisual(skins, { colors: ['black'], colorScope: 'primary' })).toEqual([]);
		expect(
			filterByVisual(skins, { colors: ['red', 'black'], colorMode: 'all' }).map((s) => s.name)
		).toEqual(['Alpha']);
	});

	it('does not mutate or reorder the input', () => {
		const input = [...skins];
		const result = filterByVisual(input);

		expect(result).not.toBe(input);
		expect(result.map((s) => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
	});
});

describe('matchesColors', () => {
	it('treats an empty selection as no filter, even for uncurated skins', () => {
		expect(matchesColors(null, [])).toBe(true);
	});

	it('cannot match an uncurated skin once a colour is selected', () => {
		expect(matchesColors(null, ['red'])).toBe(false);
	});
});

describe('visualMatchScore', () => {
	it('ranks a primary colour above a style above a secondary colour', () => {
		expect(visualMatchScore(profileA, { colors: ['red'] })).toBe(3);
		expect(visualMatchScore(profileA, { styles: ['dark'] })).toBe(2);
		expect(visualMatchScore(profileA, { colors: ['black'] })).toBe(1);
	});

	it('adds up across criteria', () => {
		expect(visualMatchScore(profileA, { colors: ['red', 'black'], styles: ['dark'] })).toBe(6);
	});

	it('counts a colour once, at its strongest position', () => {
		const both = profile({ primaryColors: ['red'], secondaryColors: ['blue'] });

		expect(visualMatchScore(both, { colors: ['red'] })).toBe(3);
	});

	it('scores zero for irrelevant criteria and for uncurated skins', () => {
		expect(visualMatchScore(profileB, { colors: ['red'] })).toBe(0);
		expect(visualMatchScore(null, { colors: ['red'], styles: ['dark'] })).toBe(0);
	});

	it('is deterministic — the same inputs always give the same score', () => {
		const criteria = { colors: ['red', 'black'] as const, styles: ['dark'] as const };
		const scores = Array.from({ length: 5 }, () =>
			visualMatchScore(profileA, { colors: [...criteria.colors], styles: [...criteria.styles] })
		);

		expect(new Set(scores).size).toBe(1);
	});

	it('does not depend on the order criteria are listed in', () => {
		expect(visualMatchScore(profileA, { colors: ['red', 'black'] })).toBe(
			visualMatchScore(profileA, { colors: ['black', 'red'] })
		);
	});
});

describe('rankByVisualMatch', () => {
	it('puts the best match first and keeps uncurated skins last but present', () => {
		const skins = [enrichSkin(skinC), enrichSkin(skinB), enrichSkin(skinA)];

		expect(rankByVisualMatch(skins, { colors: ['red'] }).map((s) => s.name)).toEqual([
			'Alpha',
			'Charlie',
			'Bravo'
		]);
	});

	it('keeps the incoming order for ties, so upstream relevance survives', () => {
		const skins = [enrichSkin(skinB), enrichSkin(skinC)];

		expect(rankByVisualMatch(skins, { colors: ['orange'] }).map((s) => s.name)).toEqual([
			'Bravo',
			'Charlie'
		]);
	});
});

describe('discovery cost', () => {
	it('never fetches prices, providers or anything else while filtering', () => {
		const skins = enrichSkins([skinA, skinB, skinC]);

		filterByVisual(skins, { colors: ['red'], styles: ['dark'] });
		rankByVisualMatch(skins, { colors: ['red'] });

		// Only the local metadata lookup is ever consulted — once per skin.
		expect(getVisualProfile).toHaveBeenCalledTimes(3);
	});
});
