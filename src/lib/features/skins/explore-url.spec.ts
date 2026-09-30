import { describe, expect, it } from 'vitest';
import { buildExploreUrl, clearFiltersUrl, exploreParams } from './explore-url';
import { parseExploreQuery } from '$lib/schemas/explore';

const query = (search = '') => parseExploreQuery(new URLSearchParams(search));

describe('exploreParams', () => {
	it('omits defaults so a plain browse stays at /explore', () => {
		expect(exploreParams(query()).toString()).toBe('');
		expect(exploreParams(query('sort=relevance&page=1')).toString()).toBe('');
	});

	it('keeps the filters that are set', () => {
		const params = exploreParams(query('q=redline&weapon=AK-47&stattrak=true&page=2'));

		expect(params.get('q')).toBe('redline');
		expect(params.get('weapon')).toBe('AK-47');
		expect(params.get('stattrak')).toBe('true');
		expect(params.get('page')).toBe('2');
	});
});

describe('buildExploreUrl', () => {
	it('adds a filter', () => {
		expect(buildExploreUrl(query(), { weapon: 'AK-47' })).toBe('/explore?weapon=AK-47');
	});

	it('removes a filter and keeps the others', () => {
		const url = buildExploreUrl(query('q=redline&weapon=AK-47&rarity=Covert'), {
			weapon: undefined
		});

		expect(url).toContain('q=redline');
		expect(url).toContain('rarity=Covert');
		expect(url).not.toContain('weapon');
	});

	it('resets to page one whenever a filter changes', () => {
		// Page 7 of the old results is meaningless once the set changes, and
		// may not even exist.
		expect(buildExploreUrl(query('page=7'), { weapon: 'AK-47' })).not.toContain('page');
		expect(buildExploreUrl(query('page=7&weapon=AK-47'), { weapon: undefined })).not.toContain(
			'page'
		);
		expect(buildExploreUrl(query('page=7'), { sort: 'name-asc' })).not.toContain('page');
	});

	it('keeps the filters when only the page changes', () => {
		const url = buildExploreUrl(query('q=redline&rarity=Covert'), { page: 3 });

		expect(url).toContain('q=redline');
		expect(url).toContain('rarity=Covert');
		expect(url).toContain('page=3');
	});

	it('drops the page parameter when returning to page one', () => {
		expect(buildExploreUrl(query('q=ak&page=4'), { page: undefined })).toBe('/explore?q=ak');
	});

	it('escapes values properly', () => {
		const url = buildExploreUrl(query(), { collection: 'The Phoenix Collection' });

		expect(url).toBe('/explore?collection=The+Phoenix+Collection');
		expect(new URL(url, 'http://x').searchParams.get('collection')).toBe('The Phoenix Collection');
	});

	it('handles a value with an ampersand without breaking the query', () => {
		const url = buildExploreUrl(query(), { q: 'a&b=c' });

		expect(new URL(url, 'http://x').searchParams.get('q')).toBe('a&b=c');
	});
});

describe('clearFiltersUrl', () => {
	it('removes every filter but keeps the ordering', () => {
		const url = clearFiltersUrl(query('q=ak&weapon=AK-47&stattrak=true&page=5&sort=name-asc'));

		expect(url).toBe('/explore?sort=name-asc');
	});

	it('returns a clean path when nothing else remains', () => {
		expect(clearFiltersUrl(query('q=ak&weapon=AK-47'))).toBe('/explore');
	});
});
