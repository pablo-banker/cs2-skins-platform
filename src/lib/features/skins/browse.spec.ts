import { describe, expect, it } from 'vitest';
import { browseSkinIndex, matchesQuery, rankSkinsByRelevance } from './browse';
import { parseExploreQuery, EXPLORE_PAGE_SIZE } from '$lib/schemas/explore';
import type { Skin, SkinVariant } from '$lib/types/skin';

const query = (search = '') => parseExploreQuery(new URLSearchParams(search));

function skin(weapon: string, name: string, overrides: Partial<Skin> = {}): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		variants: [
			{
				itemId: 1,
				marketHashName: `${weapon} | ${name} (FT)`,
				wear: 'Field-Tested',
				statTrak: false,
				souvenir: false
			}
		],
		...overrides
	};
}

const variant = (o: Partial<SkinVariant> & { itemId: number }): SkinVariant => ({
	marketHashName: 'x',
	statTrak: false,
	souvenir: false,
	...o
});

const index: Skin[] = [
	skin('AK-47', 'Redline', {
		rarity: { name: 'Classified' },
		weaponType: 'Assault Rifle',
		collection: 'Phoenix'
	}),
	skin('AK-47', 'Vulcan', { rarity: { name: 'Covert' }, weaponType: 'Assault Rifle' }),
	skin('AWP', 'Asiimov', {
		rarity: { name: 'Covert' },
		weaponType: 'Sniper Rifle',
		variants: [
			variant({ itemId: 2, wear: 'Factory New' }),
			variant({ itemId: 3, wear: 'Field-Tested', statTrak: true })
		]
	}),
	skin('M4A1-S', 'Redline', {
		rarity: { name: 'Classified' },
		variants: [variant({ itemId: 4, wear: 'Minimal Wear', souvenir: true })]
	})
];

describe('matchesQuery', () => {
	it('matches text against the full name, case-insensitively', () => {
		expect(matchesQuery(index[0], query('q=redline'))).toBe(true);
		expect(matchesQuery(index[0], query('q=AK-47'))).toBe(true);
		expect(matchesQuery(index[1], query('q=redline'))).toBe(false);
	});

	it('matches objective skin attributes exactly', () => {
		expect(matchesQuery(index[0], query('weapon=AK-47'))).toBe(true);
		expect(matchesQuery(index[0], query('weapon=AWP'))).toBe(false);
		expect(matchesQuery(index[2], query('weaponType=Sniper+Rifle'))).toBe(true);
		expect(matchesQuery(index[1], query('rarity=Covert'))).toBe(true);
		expect(matchesQuery(index[0], query('collection=Phoenix'))).toBe(true);
	});

	it('asks whether the skin HAS a matching variant, not what its card shows', () => {
		// A Factory New filter keeps every skin available Factory New.
		expect(matchesQuery(index[2], query('wear=Factory+New'))).toBe(true);
		expect(matchesQuery(index[0], query('wear=Factory+New'))).toBe(false);
		expect(matchesQuery(index[2], query('stattrak=true'))).toBe(true);
		expect(matchesQuery(index[0], query('stattrak=true'))).toBe(false);
		expect(matchesQuery(index[3], query('souvenir=true'))).toBe(true);
	});

	it('combines filters with AND', () => {
		expect(matchesQuery(index[1], query('weapon=AK-47&rarity=Covert'))).toBe(true);
		expect(matchesQuery(index[0], query('weapon=AK-47&rarity=Covert'))).toBe(false);
	});
});

describe('browseSkinIndex', () => {
	it('returns an honest total for the whole filtered set', () => {
		expect(browseSkinIndex(index, query()).total).toBe(4);
		expect(browseSkinIndex(index, query('weapon=AK-47')).total).toBe(2);
		expect(browseSkinIndex(index, query('q=redline')).total).toBe(2);
	});

	it('sorts across the whole set, not just the page', () => {
		const asc = browseSkinIndex(index, query('sort=name-asc')).skins.map((s) => s.fullName);
		const desc = browseSkinIndex(index, query('sort=name-desc')).skins.map((s) => s.fullName);

		expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
		expect(desc).toEqual([...asc].reverse());
	});

	it('ranks an exact finish name above a mere substring', () => {
		const ranked = browseSkinIndex(index, query('q=redline')).skins.map((s) => s.fullName);

		expect(ranked).toHaveLength(2);
		// Both are "Redline"; ordering then falls back to alphabetical.
		expect(ranked[0]).toBe('AK-47 | Redline');
	});

	it('orders alphabetically and deterministically when nothing is searched', () => {
		const first = browseSkinIndex(index, query()).skins.map((s) => s.fullName);
		const again = browseSkinIndex([...index].reverse(), query()).skins.map((s) => s.fullName);

		expect(first).toEqual(again);
	});

	it('pages with a fixed size and reports the page count', () => {
		const many = Array.from({ length: 50 }, (_, i) =>
			skin('AK-47', `Skin ${String(i).padStart(2, '0')}`)
		);
		const page1 = browseSkinIndex(many, query());
		const page3 = browseSkinIndex(many, query('page=3'));

		expect(page1.skins).toHaveLength(EXPLORE_PAGE_SIZE);
		expect(page1.pageCount).toBe(3);
		expect(page3.skins).toHaveLength(2);
		expect(page3.page).toBe(3);
	});

	it('clamps a page beyond the end rather than showing an empty grid', () => {
		const result = browseSkinIndex(index, query('page=99'));

		expect(result.page).toBe(1);
		expect(result.skins).toHaveLength(4);
	});

	it('reports an empty result honestly', () => {
		const result = browseSkinIndex(index, query('q=nothingmatches'));

		expect(result.total).toBe(0);
		expect(result.skins).toEqual([]);
		expect(result.pageCount).toBe(1);
	});
});

describe('rankSkinsByRelevance', () => {
	it('ranks an exact finish name above a partial one', () => {
		const ranked = rankSkinsByRelevance(
			[skin('AK-47', 'Redline Reloaded'), skin('AK-47', 'Redline'), skin('AWP', 'Thunder Redline')],
			'redline',
			10
		);

		expect(ranked.results[0].fullName).toBe('AK-47 | Redline');
		expect(ranked.total).toBe(3);
	});

	it('matches the weapon as well as the finish', () => {
		const ranked = rankSkinsByRelevance(index, 'awp', 10);

		expect(ranked.results.map((s) => s.fullName)).toEqual(['AWP | Asiimov']);
	});

	it('caps the results and reports how many matched', () => {
		const many = Array.from({ length: 30 }, (_, i) =>
			skin('AK-47', `Redline ${String(i).padStart(2, '0')}`)
		);
		const ranked = rankSkinsByRelevance(many, 'redline', 10);

		expect(ranked.results).toHaveLength(10);
		expect(ranked.total).toBe(30);
	});

	it('ignores case and surrounding whitespace', () => {
		expect(rankSkinsByRelevance(index, '  REDLINE ', 10).total).toBe(2);
	});

	it('returns nothing for an empty query rather than the whole catalog', () => {
		expect(rankSkinsByRelevance(index, '   ', 10)).toEqual({ results: [], total: 0 });
	});

	it('is deterministic for ties', () => {
		const first = rankSkinsByRelevance(index, 'redline', 10).results.map((s) => s.fullName);
		const again = rankSkinsByRelevance([...index].reverse(), 'redline', 10).results.map(
			(s) => s.fullName
		);

		expect(first).toEqual(again);
	});

	it('ranks the same way Explore sorts, so a skin cannot move between searches', () => {
		const viaSearch = rankSkinsByRelevance(index, 'redline', 10).results.map((s) => s.fullName);
		const viaExplore = browseSkinIndex(index, query('q=redline')).skins.map((s) => s.fullName);

		expect(viaSearch).toEqual(viaExplore);
	});
});
