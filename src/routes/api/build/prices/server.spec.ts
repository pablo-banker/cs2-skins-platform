import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import type { LoadoutPricingResult } from '$lib/types/loadout';

// The endpoint validates and shapes; resolution and pricing have their own
// tests in the service.
vi.mock('$lib/server/services/loadout', async (importOriginal) => ({
	// Keep the real error class so `instanceof` still means something.
	...(await importOriginal<typeof import('$lib/server/services/loadout')>()),
	priceLoadout: vi.fn()
}));

const { priceLoadout, LoadoutSelectionError } = await import('$lib/server/services/loadout');

function result(overrides: Partial<LoadoutPricingResult> = {}): LoadoutPricingResult {
	return {
		items: [
			{
				slotId: 'ak-47',
				skinSlug: 'ak-47-redline',
				state: 'priced',
				bestPriceMinor: 12815,
				currency: 'BRL',
				providerId: 'csfloat',
				providerName: 'CSFloat'
			}
		],
		total: { priceMinor: 12815, currency: 'BRL' },
		complete: true,
		fingerprint: 'ak-47:ak-47-redline:Field-Tested::',
		...overrides
	};
}

/** Calls the handler the way SvelteKit would. */
async function post(body: unknown, raw?: string) {
	const response = await POST({
		request: new Request('http://localhost/api/build/prices', {
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
	vi.mocked(priceLoadout).mockReset();
	vi.mocked(priceLoadout).mockResolvedValue(result());
});

describe('POST /api/build/prices', () => {
	it('prices a valid loadout', async () => {
		const { status, body } = await post(VALID);

		expect(status).toBe(200);
		expect(body.total).toEqual({ priceMinor: 12815, currency: 'BRL' });
		expect(body.complete).toBe(true);
	});

	it('passes the application-domain selections straight through', async () => {
		await post(VALID);

		expect(priceLoadout).toHaveBeenCalledWith(VALID.selections, expect.anything());
	});

	it('defaults an omitted variant to no preference', async () => {
		await post({ selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline' }] });

		expect(vi.mocked(priceLoadout).mock.calls[0][0]).toEqual([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: {} }
		]);
	});

	it('rejects a body that is not JSON', async () => {
		expect((await post(undefined, 'not json')).status).toBe(400);
	});

	it('rejects an empty selection list', async () => {
		const { status } = await post({ selections: [] });

		expect(status).toBe(400);
		expect(priceLoadout).not.toHaveBeenCalled();
	});

	it('rejects duplicate slots rather than pricing half the request', async () => {
		const { status } = await post({
			selections: [
				{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: {} },
				{ slotId: 'ak-47', skinSlug: 'ak-47-slate', variant: {} }
			]
		});

		expect(status).toBe(400);
		expect(priceLoadout).not.toHaveBeenCalled();
	});

	it('rejects a malformed skin slug', async () => {
		expect(
			(await post({ selections: [{ slotId: 'ak-47', skinSlug: 'AK 47 Redline', variant: {} }] }))
				.status
		).toBe(400);
	});

	it('rejects an unknown edition', async () => {
		expect(
			(
				await post({
					selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { edition: 'holo' } }]
				})
			).status
		).toBe(400);
	});

	it('rejects a raw catalog item id as the builder contract', async () => {
		// Selection identity is ours; an upstream id is not a loadout.
		const { status } = await post({ selections: [{ slotId: 'ak-47', itemId: 12632 }] });

		expect(status).toBe(400);
		expect(priceLoadout).not.toHaveBeenCalled();
	});

	it('rejects more selections than there are slots', async () => {
		const selections = Array.from({ length: 200 }, (_, index) => ({
			slotId: `slot-${index}`,
			skinSlug: 'ak-47-redline',
			variant: {}
		}));

		expect((await post({ selections })).status).toBe(400);
	});

	it('rejects unknown top-level fields', async () => {
		expect((await post({ ...VALID, budget: 5000 })).status).toBe(400);
	});

	it('answers 400 when a selection does not describe a real slot-compatible item', async () => {
		vi.mocked(priceLoadout).mockRejectedValue(
			new LoadoutSelectionError('"ak-47-redline" does not belong in slot "gloves"')
		);

		const { status, body } = await post(VALID);

		expect(status).toBe(400);
		// The detail is about our catalog, not their request.
		expect(JSON.stringify(body)).not.toContain('gloves');
	});

	it('reveals nothing about the upstream when pricing fails', async () => {
		vi.mocked(priceLoadout).mockRejectedValue(new Error('CS2Cap /prices failed with 429'));

		const { status, body } = await post(VALID);

		expect(status).toBe(503);
		// "prices" is legitimate product copy; the provider, the status code and
		// the upstream path are what must not escape.
		expect(JSON.stringify(body)).not.toMatch(/CS2Cap|429|\/prices/);
	});

	it('returns an incomplete result rather than an error when an item has no price', async () => {
		vi.mocked(priceLoadout).mockResolvedValue(
			result({
				items: [
					{ slotId: 'ak-47', skinSlug: 'ak-47-redline', state: 'no-quotes' },
					{ slotId: 'awp', skinSlug: 'awp-asiimov', state: 'error' }
				],
				total: undefined,
				complete: false
			})
		);

		const { status, body } = await post(VALID);

		expect(status).toBe(200);
		expect(body.complete).toBe(false);
		expect(body.total).toBeUndefined();
		expect(body.items.map((item: { state: string }) => item.state)).toEqual(['no-quotes', 'error']);
	});

	it('exposes no quote sets — the builder is not a marketplace comparison', async () => {
		const { body } = await post(VALID);

		expect(body.items[0]).not.toHaveProperty('quotes');
		expect(JSON.stringify(body)).not.toMatch(/redirectUrl|quotes|providersQueried/);
	});
});
