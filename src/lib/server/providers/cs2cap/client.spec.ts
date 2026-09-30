import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CS2CAP_TIMEOUT_MS, CS2CapError, requestCs2Cap } from './client';

// `$env/dynamic/private` is a SvelteKit virtual module; the tests own its value
// so the key-missing path can be exercised too.
const { mockEnv } = vi.hoisted(() => ({
	mockEnv: { CS2CAP_API_KEY: 'test-key-do-not-log' } as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const schema = z.object({ items: z.array(z.object({ item_id: z.number() })) });

/** A stub `fetch` returning one canned response, recording what it was called with. */
function stubFetch(
	body: unknown,
	init: { status?: number; headers?: Record<string, string>; json?: boolean } = {}
) {
	const response = new Response(init.json === false ? String(body) : JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { 'content-type': 'application/json', ...init.headers }
	});

	return vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
}

afterEach(() => {
	mockEnv.CS2CAP_API_KEY = 'test-key-do-not-log';
});

describe('requestCs2Cap', () => {
	it('returns parsed data and sends the bearer token', async () => {
		const fetchStub = stubFetch({ items: [{ item_id: 156 }] });

		const result = await requestCs2Cap(
			'/items',
			{ schema, query: { q: 'Redline' } },
			{
				fetch: fetchStub
			}
		);

		expect(result).toEqual({ items: [{ item_id: 156 }] });

		const [url, requestInit] = fetchStub.mock.calls[0];
		expect(String(url)).toBe('https://api.cs2c.app/v1/items?q=Redline');
		expect(new Headers(requestInit?.headers).get('authorization')).toBe(
			'Bearer test-key-do-not-log'
		);
	});

	it('drops nullish query values and repeats array values', async () => {
		const fetchStub = stubFetch({ items: [] });

		await requestCs2Cap(
			'/prices',
			{
				schema,
				query: {
					item_id: 156,
					phase: undefined,
					wear: null,
					providers: ['steam', 'csfloat'],
					exclude_stale: true
				}
			},
			{ fetch: fetchStub }
		);

		const url = new URL(String(fetchStub.mock.calls[0][0]));
		expect(url.searchParams.getAll('providers')).toEqual(['steam', 'csfloat']);
		expect(url.searchParams.get('exclude_stale')).toBe('true');
		expect(url.searchParams.has('phase')).toBe(false);
		expect(url.searchParams.has('wear')).toBe(false);
	});

	it('fails with a config error, and no request, when the key is missing', async () => {
		mockEnv.CS2CAP_API_KEY = '';
		const fetchStub = stubFetch({ items: [] });

		const error = await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		);

		expect(error).toBeInstanceOf(CS2CapError);
		expect((error as CS2CapError).kind).toBe('config');
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('maps 401 to an auth error carrying the upstream code', async () => {
		const fetchStub = stubFetch(
			{ code: 'AUTH_INVALID_API_KEY', detail: 'Invalid API key' },
			{ status: 401 }
		);

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('auth');
		expect(error.status).toBe(401);
		expect(error.code).toBe('AUTH_INVALID_API_KEY');
		expect(error.retryable).toBe(false);
	});

	it('maps 403 to forbidden, which is a plan limit rather than a bad key', async () => {
		const fetchStub = stubFetch(
			{ code: 'PLAN_FEATURE_UNAVAILABLE', detail: 'Upgrade required' },
			{ status: 403 }
		);

		const error = (await requestCs2Cap('/prices/candles', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('forbidden');
	});

	it('maps 429 to a retryable rate-limit error with Retry-After', async () => {
		const fetchStub = stubFetch(
			{ code: 'RATE_LIMIT_EXCEEDED', detail: 'Too many requests' },
			{ status: 429, headers: { 'retry-after': '12' } }
		);

		const error = (await requestCs2Cap('/prices', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('rate_limit');
		expect(error.retryAfterSeconds).toBe(12);
		expect(error.retryable).toBe(true);
	});

	it('maps 503 to a retryable unavailable error', async () => {
		const fetchStub = stubFetch(
			{ code: 'PRICES_INDEX_UNAVAILABLE', detail: 'Try again shortly' },
			{ status: 503 }
		);

		const error = (await requestCs2Cap('/prices', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('unavailable');
		expect(error.retryable).toBe(true);
	});

	it('maps 404 to not_found', async () => {
		const fetchStub = stubFetch({ code: 'NOT_FOUND', detail: 'No such item' }, { status: 404 });

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('not_found');
	});

	it('survives an error body that is not the documented envelope', async () => {
		const fetchStub = stubFetch('<html>bad request</html>', { status: 400, json: false });

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('upstream');
		expect(error.status).toBe(400);
		expect(error.code).toBeUndefined();
	});

	it('treats a 5xx gateway failure as unavailable, so it can be retried', async () => {
		const fetchStub = stubFetch({ detail: 'Bad gateway' }, { status: 502 });

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('unavailable');
		expect(error.retryable).toBe(true);
	});

	it('rejects a 200 whose body does not match the schema', async () => {
		const fetchStub = stubFetch({ items: [{ item_id: 'not-a-number' }] });

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('invalid_response');
		expect(error.message).toContain('items.0.item_id');
	});

	it('treats a timeout as unavailable', async () => {
		const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
			name: 'TimeoutError'
		});
		const fetchStub = vi.fn<typeof globalThis.fetch>().mockRejectedValue(timeout);

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('unavailable');
		expect(error.message).toContain(String(CS2CAP_TIMEOUT_MS));
	});

	it('treats an unreachable host as unavailable', async () => {
		const fetchStub = vi
			.fn<typeof globalThis.fetch>()
			.mockRejectedValue(new TypeError('fetch failed'));

		const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
			(cause: unknown) => cause
		)) as CS2CapError;

		expect(error.kind).toBe('unavailable');
	});

	it('never puts the API key into an error message', async () => {
		const cases = [
			stubFetch({ code: 'AUTH_INVALID_API_KEY', detail: 'Invalid API key' }, { status: 401 }),
			stubFetch({ items: [{ item_id: 'nope' }] }),
			stubFetch({ detail: 'boom' }, { status: 500 })
		];

		for (const fetchStub of cases) {
			const error = (await requestCs2Cap('/items', { schema }, { fetch: fetchStub }).catch(
				(cause: unknown) => cause
			)) as CS2CapError;

			expect(error.message).not.toContain('test-key-do-not-log');
			expect(JSON.stringify({ message: error.message, code: error.code })).not.toContain(
				'test-key-do-not-log'
			);
		}
	});
});
