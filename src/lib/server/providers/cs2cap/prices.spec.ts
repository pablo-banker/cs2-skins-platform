import { describe, expect, it, vi } from 'vitest';
import { CS2CapError } from './client';
import { getQuotesForItems, MAX_BATCH_ITEMS } from './prices';

// `$env/dynamic/private` is a SvelteKit virtual module; the tests own its value.
vi.mock('$env/dynamic/private', () => ({
	env: { CS2CAP_API_KEY: 'test-key-do-not-log' } as Record<string, string | undefined>
}));

/** A batch payload in the shape the published OpenAPI contract describes. */
function batchResponse(
	items: { item_id: number; quotes: Record<string, unknown>[] }[],
	overrides: Record<string, unknown> = {}
) {
	return {
		meta: {
			currency: 'BRL',
			requested_item_count: items.length,
			found_item_count: items.length,
			providers_queried: ['steam', 'csfloat'],
			generated_at: '2026-09-22T09:00:00Z'
		},
		items: items.map((item) => ({
			item_id: item.item_id,
			market_hash_name: `Item ${item.item_id}`,
			quotes: item.quotes
		})),
		items_not_found: [],
		...overrides
	};
}

function quote(provider: string, lowestAsk: number, extra: Record<string, unknown> = {}) {
	return { provider, lowest_ask: lowestAsk, quantity: 3, stale: false, ...extra };
}

function stubFetch(body: unknown, status = 200) {
	return vi.fn<typeof globalThis.fetch>().mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		})
	);
}

/** The JSON body the integration actually sent. */
function sentBody(fetchStub: ReturnType<typeof stubFetch>): Record<string, unknown> {
	return JSON.parse(String(fetchStub.mock.calls[0][1]?.body));
}

describe('getQuotesForItems request', () => {
	it('posts to the batch endpoint', async () => {
		const fetchStub = stubFetch(batchResponse([{ item_id: 1, quotes: [] }]));

		await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub });

		const [url, init] = fetchStub.mock.calls[0];
		expect(String(url)).toBe('https://api.cs2c.app/v1/prices/batch');
		expect(init?.method).toBe('POST');
		expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
		expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key-do-not-log');
	});

	it('sends every requested id, in BRL, excluding stale listings', async () => {
		const fetchStub = stubFetch(
			batchResponse([
				{ item_id: 10, quotes: [] },
				{ item_id: 20, quotes: [] }
			])
		);

		await getQuotesForItems({ itemIds: [10, 20] }, { fetch: fetchStub });

		expect(sentBody(fetchStub)).toEqual({
			item_ids: [10, 20],
			currency: 'BRL',
			exclude_stale: true
		});
	});

	it('collapses duplicate ids into one request entry', async () => {
		const fetchStub = stubFetch(batchResponse([{ item_id: 7, quotes: [] }]));

		await getQuotesForItems({ itemIds: [7, 7, 7] }, { fetch: fetchStub });

		expect(sentBody(fetchStub).item_ids).toEqual([7]);
	});

	it('honours an explicit currency, provider filter and stale option', async () => {
		const fetchStub = stubFetch(batchResponse([{ item_id: 1, quotes: [] }]));

		await getQuotesForItems(
			{ itemIds: [1], currency: 'USD', providerIds: ['steam'], excludeStale: false },
			{ fetch: fetchStub }
		);

		expect(sentBody(fetchStub)).toEqual({
			item_ids: [1],
			currency: 'USD',
			providers: ['steam'],
			exclude_stale: false
		});
	});

	it('asks for nothing when given no ids', async () => {
		const fetchStub = stubFetch(batchResponse([]));

		await expect(getQuotesForItems({ itemIds: [] }, { fetch: fetchStub })).resolves.toEqual([]);
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('refuses more items than upstream accepts, without asking', async () => {
		const fetchStub = stubFetch(batchResponse([]));
		const tooMany = Array.from({ length: MAX_BATCH_ITEMS + 1 }, (_, index) => index + 1);

		await expect(getQuotesForItems({ itemIds: tooMany }, { fetch: fetchStub })).rejects.toThrow(
			CS2CapError
		);
		expect(fetchStub).not.toHaveBeenCalled();
	});
});

describe('getQuotesForItems results', () => {
	it('normalizes quotes into domain shape, cheapest first', async () => {
		const fetchStub = stubFetch(
			batchResponse([
				{
					item_id: 12632,
					quotes: [
						quote('csfloat', 14250, { last_updated: '2026-09-22T08:00:00Z' }),
						quote('steam', 11900)
					]
				}
			])
		);

		const [set] = await getQuotesForItems({ itemIds: [12632] }, { fetch: fetchStub });

		expect(set.itemId).toBe(12632);
		expect(set.currency).toBe('BRL');
		expect(set.providersQueried).toEqual(['steam', 'csfloat']);
		expect(set.quotes).toEqual([
			{
				providerId: 'steam',
				itemId: 12632,
				priceMinor: 11900,
				currency: 'BRL',
				quantity: 3,
				updatedAt: undefined,
				stale: false
			},
			{
				providerId: 'csfloat',
				itemId: 12632,
				priceMinor: 14250,
				currency: 'BRL',
				quantity: 3,
				updatedAt: '2026-09-22T08:00:00Z',
				stale: false
			}
		]);
	});

	it('carries no redirect, because the batch contract has no link field', async () => {
		// Fabricating one would be inventing a marketplace URL. The UI treats a
		// missing redirect as normal and simply shows no offer link.
		const fetchStub = stubFetch(batchResponse([{ item_id: 1, quotes: [quote('steam', 100)] }]));

		const [set] = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub });

		expect(set.quotes[0].redirectUrl).toBeUndefined();
	});

	it('returns an empty quote set for an item upstream found nothing for', async () => {
		const fetchStub = stubFetch(
			batchResponse([{ item_id: 1, quotes: [quote('steam', 100)] }], { items_not_found: [2] })
		);

		const sets = await getQuotesForItems({ itemIds: [1, 2] }, { fetch: fetchStub });

		expect(sets).toHaveLength(2);
		expect(sets[1]).toMatchObject({ itemId: 2, quotes: [] });
	});

	it('answers for every requested id, in request order', async () => {
		const fetchStub = stubFetch(
			batchResponse([
				{ item_id: 30, quotes: [quote('steam', 300)] },
				{ item_id: 10, quotes: [quote('steam', 100)] }
			])
		);

		const sets = await getQuotesForItems({ itemIds: [10, 20, 30] }, { fetch: fetchStub });

		expect(sets.map((set) => set.itemId)).toEqual([10, 20, 30]);
	});

	it('defaults a missing stale flag to false', async () => {
		const fetchStub = stubFetch(
			batchResponse([{ item_id: 1, quotes: [{ provider: 'steam', lowest_ask: 100, quantity: 1 }] }])
		);

		const [set] = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub });

		expect(set.quotes[0].stale).toBe(false);
	});

	it('keeps a stale quote flagged rather than dropping it', async () => {
		const fetchStub = stubFetch(
			batchResponse([{ item_id: 1, quotes: [quote('steam', 100, { stale: true })] }])
		);

		const [set] = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub });

		expect(set.quotes[0].stale).toBe(true);
	});

	it('uses the currency the response declares, not the one requested', async () => {
		const fetchStub = stubFetch(
			batchResponse([{ item_id: 1, quotes: [quote('steam', 100)] }], {
				meta: {
					currency: 'USD',
					requested_item_count: 1,
					found_item_count: 1,
					providers_queried: ['steam'],
					generated_at: '2026-09-22T09:00:00Z'
				}
			})
		);

		const [set] = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub });

		expect(set.currency).toBe('USD');
		expect(set.quotes[0].currency).toBe('USD');
	});
});

describe('getQuotesForItems failures', () => {
	it('maps a plan restriction to a forbidden error', async () => {
		const fetchStub = stubFetch({ code: 'forbidden', detail: 'Batch requires Starter' }, 403);

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(error).toBeInstanceOf(CS2CapError);
		expect(error.kind).toBe('forbidden');
		expect(error.status).toBe(403);
	});

	it('maps a rejected key to an auth error', async () => {
		const fetchStub = stubFetch({ code: 'unauthorized' }, 401);

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(error.kind).toBe('auth');
	});

	it('maps an exceeded batch size to an upstream error', async () => {
		const fetchStub = stubFetch({ code: 'bad_request', detail: 'Batch size exceeded' }, 400);

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(error.kind).toBe('upstream');
		expect(error.status).toBe(400);
	});

	it('maps a quota failure to a rate limit error', async () => {
		const fetchStub = stubFetch({ code: 'rate_limited' }, 429);

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(error.kind).toBe('rate_limit');
	});

	it('rejects a 200 that does not match the schema', async () => {
		const fetchStub = stubFetch({ meta: { currency: 'BRL' }, items: 'not-an-array' });

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(error).toBeInstanceOf(CS2CapError);
		expect(error.kind).toBe('invalid_response');
	});

	it('never names the API key in a failure', async () => {
		const fetchStub = stubFetch({ code: 'forbidden', detail: 'nope' }, 403);

		const error = await getQuotesForItems({ itemIds: [1] }, { fetch: fetchStub }).catch(
			(cause) => cause
		);

		expect(JSON.stringify({ message: error.message, ...error })).not.toContain(
			'test-key-do-not-log'
		);
	});
});
