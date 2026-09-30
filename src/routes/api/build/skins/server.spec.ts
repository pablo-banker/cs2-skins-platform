import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import type { LoadoutSkinPage } from '$lib/types/loadout';

// The endpoint's job is validation and shaping; the loadout service has its own
// tests and the market service must never be reached from here at all.
vi.mock('$lib/server/services/loadout', () => ({ searchSlotSkins: vi.fn() }));
vi.mock('$lib/server/services/market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn()
}));

const { searchSlotSkins } = await import('$lib/server/services/loadout');
const { getManySkinPrices, getMarketProviders } = await import('$lib/server/services/market');

function page(overrides: Partial<LoadoutSkinPage> = {}): LoadoutSkinPage {
	return {
		slotId: 'ak-47',
		options: [
			{
				slug: 'ak-47-redline',
				weapon: 'AK-47',
				name: 'Redline',
				fullName: 'AK-47 | Redline',
				imageUrl: 'https://cdn.example.test/a.png',
				rarity: { name: 'Classified' },
				variants: [{ itemId: 101, wear: 'Field-Tested', statTrak: false, souvenir: false }]
			}
		],
		total: 1,
		page: 1,
		pageCount: 1,
		...overrides
	};
}

/** Calls the handler the way SvelteKit would. */
async function get(search: string) {
	const response = await GET({
		url: new URL(`http://localhost/api/build/skins${search}`),
		fetch: globalThis.fetch,
		setHeaders: () => {}
	} as unknown as Parameters<typeof GET>[0]);

	return { status: response.status, body: await response.json() };
}

beforeEach(() => {
	vi.mocked(searchSlotSkins).mockReset();
	vi.mocked(getManySkinPrices).mockReset();
	vi.mocked(getMarketProviders).mockReset();
	vi.mocked(searchSlotSkins).mockResolvedValue(page());
});

describe('GET /api/build/skins', () => {
	it('answers for a valid slot', async () => {
		const { status, body } = await get('?slot=ak-47');

		expect(status).toBe(200);
		expect(body.slotId).toBe('ak-47');
		expect(body.options).toHaveLength(1);
	});

	it('passes the query and page through', async () => {
		await get('?slot=knife&q=doppler&page=3');

		expect(searchSlotSkins).toHaveBeenCalledWith(
			'knife',
			{ q: 'doppler', page: 3 },
			expect.anything()
		);
	});

	it('defaults to the first page', async () => {
		await get('?slot=ak-47');

		expect(vi.mocked(searchSlotSkins).mock.calls[0][1]).toEqual({ q: undefined, page: 1 });
	});

	it('falls back to page 1 for a nonsense page rather than erroring', async () => {
		await get('?slot=ak-47&page=banana');

		expect(vi.mocked(searchSlotSkins).mock.calls[0][1].page).toBe(1);
	});

	it('rejects a missing slot', async () => {
		const { status } = await get('');

		expect(status).toBe(400);
		expect(searchSlotSkins).not.toHaveBeenCalled();
	});

	it('rejects an unknown slot rather than answering with no skins', async () => {
		// An empty page would read as "this slot has nothing in it".
		vi.mocked(searchSlotSkins).mockResolvedValue(undefined);

		const { status, body } = await get('?slot=rocket-launcher');

		expect(status).toBe(400);
		expect(body.options).toBeUndefined();
	});

	it('rejects an over-long query', async () => {
		expect((await get(`?slot=ak-47&q=${'x'.repeat(200)}`)).status).toBe(400);
	});

	it('returns a bounded page, never the whole slot', async () => {
		const { body } = await get('?slot=knife');

		expect(body.options.length).toBeLessThanOrEqual(20);
	});

	it('returns normalized variants, not catalog internals', async () => {
		const { body } = await get('?slot=ak-47');

		expect(body.options[0].variants[0]).toEqual({
			itemId: 101,
			wear: 'Field-Tested',
			statTrak: false,
			souvenir: false
		});
		expect(JSON.stringify(body)).not.toContain('marketHashName');
		expect(JSON.stringify(body)).not.toContain('lowest_ask');
	});

	it('makes no market request at all', async () => {
		await get('?slot=ak-47&q=redline');

		expect(getManySkinPrices).not.toHaveBeenCalled();
		expect(getMarketProviders).not.toHaveBeenCalled();
	});

	it('quotes no price — browsing is free', async () => {
		const { body } = await get('?slot=ak-47');

		expect(JSON.stringify(body)).not.toMatch(/price|currency|provider/i);
	});

	it('reveals nothing about the upstream when the catalog fails', async () => {
		vi.mocked(searchSlotSkins).mockRejectedValue(new Error('CS2Cap /items failed with 429'));

		const { status, body } = await get('?slot=ak-47');

		expect(status).toBe(503);
		expect(JSON.stringify(body)).not.toMatch(/CS2Cap|429|items/);
	});
});
