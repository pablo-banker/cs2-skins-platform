import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { SEARCH_RESULT_LIMIT } from '$lib/schemas/search';

// The endpoint's job is validation and shaping; the catalog service has its
// own tests and is never reached from here.
vi.mock('$lib/server/services/catalog', () => ({ searchSkinSuggestions: vi.fn() }));

const { searchSkinSuggestions } = await import('$lib/server/services/catalog');

function item(slug: string) {
	return {
		slug,
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		imageUrl: 'https://cdn.example.test/a.png',
		rarity: { name: 'Classified' },
		representativeWear: 'Minimal Wear'
	};
}

/** Calls the handler the way SvelteKit would. */
async function get(search: string) {
	// The handler reads only these three; the rest of a RequestEvent is not
	// worth constructing for a test.
	const response = await GET({
		url: new URL(`http://localhost/api/search/skins${search}`),
		fetch: globalThis.fetch,
		setHeaders: () => {}
	} as unknown as Parameters<typeof GET>[0]);

	return { status: response.status, body: await response.json() };
}

beforeEach(() => {
	vi.mocked(searchSkinSuggestions).mockReset();
	vi.mocked(searchSkinSuggestions).mockResolvedValue({
		results: [item('ak-47-redline')],
		total: 1
	});
});

describe('GET /api/search/skins validation', () => {
	it('rejects a missing query', async () => {
		const { status, body } = await get('');

		expect(status).toBe(400);
		expect(body.error).toBe('Invalid search query');
		expect(searchSkinSuggestions).not.toHaveBeenCalled();
	});

	it('rejects a query below the threshold', async () => {
		expect((await get('?q=a')).status).toBe(400);
		expect((await get('?q=%20%20')).status).toBe(400);
		expect(searchSkinSuggestions).not.toHaveBeenCalled();
	});

	it('rejects an abusively long query', async () => {
		expect((await get(`?q=${'a'.repeat(101)}`)).status).toBe(400);
	});

	it('normalizes before searching, so equivalent queries share a cache entry', async () => {
		await get('?q=%20%20ReDLine%20%20');

		expect(searchSkinSuggestions).toHaveBeenCalledWith('redline', SEARCH_RESULT_LIMIT, {
			fetch: expect.anything()
		});
	});
});

describe('GET /api/search/skins results', () => {
	it('returns a small, stable contract', async () => {
		const { status, body } = await get('?q=redline');

		expect(status).toBe(200);
		expect(Object.keys(body).sort()).toEqual(['hasMore', 'items', 'query']);
		expect(body.query).toBe('redline');
		expect(body.items).toHaveLength(1);
	});

	it('exposes only the fields the dialog renders', async () => {
		const { body } = await get('?q=redline');

		expect(Object.keys(body.items[0]).sort()).toEqual([
			'fullName',
			'imageUrl',
			'name',
			'rarity',
			'representativeWear',
			'slug',
			'weapon'
		]);
	});

	it('leaks no upstream field, identifier or price', async () => {
		const { body } = await get('?q=redline');
		const raw = JSON.stringify(body);

		for (const forbidden of [
			'lowest_ask',
			'market_hash_name',
			'is_stattrak',
			'rarity_name',
			'itemId',
			'item_id',
			'priceMinor',
			'cs2c.app/v1'
		]) {
			expect(raw, forbidden).not.toContain(forbidden);
		}
	});

	it('reports when more matched than were returned', async () => {
		vi.mocked(searchSkinSuggestions).mockResolvedValue({
			results: Array.from({ length: SEARCH_RESULT_LIMIT }, (_, i) => item(`skin-${i}`)),
			total: 61
		});

		const { body } = await get('?q=ak');

		expect(body.items).toHaveLength(SEARCH_RESULT_LIMIT);
		expect(body.hasMore).toBe(true);
	});

	it('says there is no more when everything fitted', async () => {
		expect((await get('?q=redline')).body.hasMore).toBe(false);
	});

	it('returns an empty list rather than an error for no matches', async () => {
		vi.mocked(searchSkinSuggestions).mockResolvedValue({ results: [], total: 0 });

		const { status, body } = await get('?q=zzzz');

		expect(status).toBe(200);
		expect(body.items).toEqual([]);
	});
});

describe('GET /api/search/skins failures', () => {
	it('turns an upstream failure into a safe, calm response', async () => {
		vi.mocked(searchSkinSuggestions).mockRejectedValue(
			new Error('CS2Cap /items failed with 429: rate limited')
		);

		const { status, body } = await get('?q=redline');

		expect(status).toBe(503);
		expect(body.error).toBe('Search is temporarily unavailable');
		// Nothing about the upstream, the status or the key reaches the client.
		expect(JSON.stringify(body)).not.toMatch(/CS2Cap|429|rate limited|api/i);
	});
});
