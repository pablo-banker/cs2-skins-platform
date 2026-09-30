import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import type { LoadoutResolution } from '$lib/server/services/loadout';

// The endpoint validates and shapes; resolution has its own tests. The market
// service is mocked purely so a call to it would be visible.
vi.mock('$lib/server/services/loadout', () => ({ resolveSelectionsTolerantly: vi.fn() }));
vi.mock('$lib/server/services/market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPrices: vi.fn()
}));

const { resolveSelectionsTolerantly } = await import('$lib/server/services/loadout');
const market = await import('$lib/server/services/market');

function resolution(overrides: Partial<LoadoutResolution> = {}): LoadoutResolution {
	return {
		selections: [
			{
				slotId: 'ak-47',
				option: {
					slug: 'ak-47-redline',
					weapon: 'AK-47',
					name: 'Redline',
					fullName: 'AK-47 | Redline',
					imageUrl: 'https://cdn.example.test/a.png',
					rarity: { name: 'Classified' },
					variants: [{ itemId: 101, wear: 'Field-Tested', statTrak: false, souvenir: false }]
				},
				variant: { wear: 'Field-Tested', edition: 'normal' }
			}
		],
		rejected: [],
		...overrides
	};
}

/** Calls the handler the way SvelteKit would. */
async function post(body: unknown, raw?: string) {
	const response = await POST({
		request: new Request('http://localhost/api/build/resolve', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: raw ?? JSON.stringify(body)
		}),
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof POST>[0]);

	return { status: response.status, body: await response.json() };
}

const VALID = {
	selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }]
};

beforeEach(() => {
	vi.mocked(resolveSelectionsTolerantly).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();
	vi.mocked(market.getSkinPrices).mockReset();
	vi.mocked(resolveSelectionsTolerantly).mockResolvedValue(resolution());
});

describe('POST /api/build/resolve', () => {
	it('returns current catalog data for valid selections', async () => {
		const { status, body } = await post(VALID);

		expect(status).toBe(200);
		expect(body.selections[0].option.fullName).toBe('AK-47 | Redline');
		expect(body.rejected).toEqual([]);
	});

	it('passes the selections straight through', async () => {
		await post(VALID);

		expect(resolveSelectionsTolerantly).toHaveBeenCalledWith(VALID.selections, expect.anything());
	});

	it('returns the exact variant, never a substitute', async () => {
		const { body } = await post(VALID);

		expect(body.selections[0].variant).toEqual({ wear: 'Field-Tested', edition: 'normal' });
	});

	it('reports what could not be restored rather than dropping it', async () => {
		vi.mocked(resolveSelectionsTolerantly).mockResolvedValue(
			resolution({
				rejected: [
					{ slotId: 'awp', reason: 'unknown-skin' },
					{ slotId: 'gloves', reason: 'incompatible' },
					{ reason: 'unknown-slot' },
					{ slotId: 'knife', reason: 'invalid-variant' }
				]
			})
		);

		const { status, body } = await post(VALID);

		// Partial recovery is a 200 with the damage listed, not an error.
		expect(status).toBe(200);
		expect(body.rejected).toHaveLength(4);
		expect(body.selections).toHaveLength(1);
	});

	it('uses safe reason codes, not server messages', async () => {
		vi.mocked(resolveSelectionsTolerantly).mockResolvedValue(
			resolution({ rejected: [{ slotId: 'awp', reason: 'unknown-skin' }] })
		);

		const { body } = await post(VALID);

		expect(body.rejected[0]).toEqual({ slotId: 'awp', reason: 'unknown-skin' });
	});

	it('accepts an empty list without calling anything unnecessary', async () => {
		vi.mocked(resolveSelectionsTolerantly).mockResolvedValue({ selections: [], rejected: [] });

		const { status, body } = await post({ selections: [] });

		expect(status).toBe(200);
		expect(body).toEqual({ selections: [], rejected: [] });
	});

	it('rejects a body that is not JSON', async () => {
		expect((await post(undefined, 'not json')).status).toBe(400);
	});

	it('rejects a malformed payload before resolving anything', async () => {
		for (const body of [
			{ selections: [{ slotId: 'ak-47' }] },
			{ selections: [{ slotId: 'ak-47', skinSlug: 'AK 47 Redline', variant: {} }] },
			{ selections: [{ slotId: 'ak-47', itemId: 12632 }] },
			{ selections: [{ slotId: 'ak-47', skinSlug: 'a-b', variant: { edition: 'holo' } }] },
			{ selections: VALID.selections, budget: 500 }
		]) {
			expect((await post(body)).status, JSON.stringify(body)).toBe(400);
		}

		expect(resolveSelectionsTolerantly).not.toHaveBeenCalled();
	});

	it('rejects more selections than there are slots', async () => {
		const selections = Array.from({ length: 200 }, (_, index) => ({
			slotId: `slot-${index}`,
			skinSlug: 'ak-47-redline',
			variant: {}
		}));

		expect((await post({ selections })).status).toBe(400);
	});

	it('asks the market for nothing — this is not a pricing endpoint', async () => {
		await post(VALID);

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
		expect(market.getSkinPrices).not.toHaveBeenCalled();
	});

	it('returns no price, provider or total', async () => {
		const { body } = await post(VALID);

		expect(JSON.stringify(body)).not.toMatch(/priceMinor|currency|providerId|steam|total/i);
	});

	it('reveals nothing about the upstream when the catalog fails', async () => {
		vi.mocked(resolveSelectionsTolerantly).mockRejectedValue(
			new Error('CS2Cap /items failed with 429')
		);

		const { status, body } = await post(VALID);

		expect(status).toBe(503);
		expect(JSON.stringify(body)).not.toMatch(/CS2Cap|429|\/items/);
	});
});
