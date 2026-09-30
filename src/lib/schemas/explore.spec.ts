import { describe, expect, it } from 'vitest';
import { hasActiveFilters, parseExploreQuery, EXPLORE_PAGE_SIZE } from './explore';

const parse = (search: string) => parseExploreQuery(new URLSearchParams(search));

describe('parseExploreQuery defaults', () => {
	it('returns a usable query for an empty URL', () => {
		expect(parse('')).toEqual({
			q: undefined,
			weapon: undefined,
			weaponType: undefined,
			wear: undefined,
			rarity: undefined,
			collection: undefined,
			stattrak: undefined,
			souvenir: undefined,
			sort: 'relevance',
			page: 1
		});
	});

	it('keeps a fixed page size', () => {
		expect(EXPLORE_PAGE_SIZE).toBe(24);
	});
});

describe('parseExploreQuery text filters', () => {
	it('reads and trims filter values', () => {
		const query = parse('q=%20redline%20&weapon=AK-47&rarity=Covert');

		expect(query.q).toBe('redline');
		expect(query.weapon).toBe('AK-47');
		expect(query.rarity).toBe('Covert');
	});

	it('treats blank and whitespace-only values as no filter', () => {
		const query = parse('q=&weapon=%20%20&collection=');

		expect(query.q).toBeUndefined();
		expect(query.weapon).toBeUndefined();
		expect(query.collection).toBeUndefined();
	});
});

describe('parseExploreQuery page', () => {
	it('reads a valid page', () => {
		expect(parse('page=4').page).toBe(4);
	});

	it('falls back to page 1 for garbage, zero and negatives', () => {
		for (const search of ['page=0', 'page=-3', 'page=abc', 'page=1.5', 'page=', 'page=1e999']) {
			expect(parse(search).page, search).toBe(1);
		}
	});
});

describe('parseExploreQuery booleans', () => {
	it('narrows only on an explicit true', () => {
		expect(parse('stattrak=true').stattrak).toBe(true);
		expect(parse('souvenir=true').souvenir).toBe(true);
	});

	it('treats anything else as "any" rather than "exclude"', () => {
		for (const search of ['stattrak=false', 'stattrak=1', 'stattrak=yes', 'stattrak=']) {
			expect(parse(search).stattrak, search).toBeUndefined();
		}
	});
});

describe('parseExploreQuery sort', () => {
	it('accepts the known sorts', () => {
		expect(parse('sort=name-asc').sort).toBe('name-asc');
		expect(parse('sort=name-desc').sort).toBe('name-desc');
		expect(parse('sort=relevance').sort).toBe('relevance');
	});

	it('falls back to relevance for anything unknown', () => {
		// A URL asking for a sort we cannot perform honestly gets the default,
		// not an error and not a fabricated ordering.
		for (const search of ['sort=price-asc', 'sort=trending', 'sort=%20', 'sort=']) {
			expect(parse(search).sort, search).toBe('relevance');
		}
	});
});

describe('hasActiveFilters', () => {
	it('is false for sort and page alone', () => {
		expect(hasActiveFilters(parse(''))).toBe(false);
		expect(hasActiveFilters(parse('page=3&sort=name-asc'))).toBe(false);
	});

	it('is true for any narrowing filter', () => {
		for (const search of ['q=ak', 'weapon=AK-47', 'wear=Factory+New', 'stattrak=true']) {
			expect(hasActiveFilters(parse(search)), search).toBe(true);
		}
	});
});
