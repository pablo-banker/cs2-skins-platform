import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { MAX_WISHLIST_ITEMS } from '$lib/schemas/wishlist';
import type { WishlistResolution } from '$lib/types/wishlist';

// The endpoint's job is validation and shaping; the service has its own tests.
vi.mock('$lib/server/services/wishlist', () => ({ resolveWishlist: vi.fn() }));

const { resolveWishlist } = await import('$lib/server/services/wishlist');

const RESOLVED: WishlistResolution = {
	items: [
		{
			key: 'ak-47-redline|Field-Tested||',
			skinSlug: 'ak-47-redline',
			weapon: 'AK-47',
			name: 'Redline',
			fullName: 'AK-47 | Redline',
			variant: { wear: 'Field-Tested', edition: 'normal' },
			priceState: 'priced',
			currentPriceMinor: 13_006,
			currency: 'BRL',
			providerId: 'csfloat',
			providerName: 'CSFloat'
		}
	],
	rejected: []
};

/** Calls the handler the way SvelteKit would. */
async function post(body: unknown, raw?: string) {
	const response = await POST({
		request: new Request('http://localhost/api/wishlist/resolve', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: raw ?? JSON.stringify(body)
		}),
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof POST>[0]);

	return { status: response.status, body: await response.json() };
}

const identity = (overrides: Record<string, unknown> = {}) => ({
	skinSlug: 'ak-47-redline',
	variant: { wear: 'Field-Tested' },
	...overrides
});

beforeEach(() => {
	vi.mocked(resolveWishlist).mockReset();
	vi.mocked(resolveWishlist).mockResolvedValue(RESOLVED);
});

describe('validation', () => {
	it('rejects a body that is not JSON', async () => {
		const { status, body } = await post(undefined, 'not json');

		expect(status).toBe(400);
		expect(body.error).toBe('Invalid request');
		expect(resolveWishlist).not.toHaveBeenCalled();
	});

	it('rejects a payload that is not shaped like saved identities', async () => {
		for (const payload of [{}, { items: 'lots' }, { items: [{ slug: 'x' }] }, []]) {
			expect((await post(payload)).status, JSON.stringify(payload)).toBe(400);
		}

		expect(resolveWishlist).not.toHaveBeenCalled();
	});

	it('rejects the snapshot and the timestamp', async () => {
		// The server has no use for them and must not be handed them.
		for (const extra of [{ addedAt: '2026-09-29T10:00:00.000Z' }, { addedPriceMinor: 1000 }]) {
			expect((await post({ items: [identity(extra)] })).status, JSON.stringify(extra)).toBe(400);
		}
	});

	it('rejects a catalog item id', async () => {
		expect((await post({ items: [identity({ itemId: 12_633 })] })).status).toBe(400);
	});

	it('rejects the same exact variant twice', async () => {
		expect((await post({ items: [identity(), identity()] })).status).toBe(400);
	});

	it('rejects more than the cap', async () => {
		const many = Array.from({ length: MAX_WISHLIST_ITEMS + 1 }, (_, index) =>
			identity({ skinSlug: `skin-${index}` })
		);

		expect((await post({ items: many })).status).toBe(400);
		expect((await post({ items: many.slice(0, MAX_WISHLIST_ITEMS) })).status).toBe(200);
	});

	it('accepts an empty wishlist', async () => {
		// Restoring is tolerant; an empty list is a real state, not an error.
		expect((await post({ items: [] })).status).toBe(200);
	});

	it('accepts two exteriors of one skin', async () => {
		const { status } = await post({
			items: [identity(), identity({ variant: { wear: 'Minimal Wear' } })]
		});

		expect(status).toBe(200);
	});
});

describe('answering', () => {
	it('returns the resolution', async () => {
		const { status, body } = await post({ items: [identity()] });

		expect(status).toBe(200);
		expect(body).toEqual(RESOLVED);
	});

	it('resolves once per request', async () => {
		await post({ items: [identity()] });

		expect(resolveWishlist).toHaveBeenCalledTimes(1);
	});

	it('passes the event fetch through, so the server cache is used', async () => {
		await post({ items: [identity()] });

		expect(vi.mocked(resolveWishlist).mock.calls[0][1]).toMatchObject({
			fetch: expect.any(Function)
		});
	});

	it('answers 200 when saved items no longer resolve', async () => {
		// A payload of identities that no longer exist is not a client error.
		vi.mocked(resolveWishlist).mockResolvedValue({
			items: [],
			rejected: [{ key: 'gone|||', skinSlug: 'gone', reason: 'unknown-skin' }]
		});

		const { status, body } = await post({ items: [identity({ skinSlug: 'gone' })] });

		expect(status).toBe(200);
		expect(body.rejected).toHaveLength(1);
	});

	it('returns 503 when the catalog itself fails', async () => {
		vi.mocked(resolveWishlist).mockRejectedValue(new Error('catalog unavailable'));

		const { status, body } = await post({ items: [identity()] });

		expect(status).toBe(503);
		expect(body.error).toBe('Your wishlist could not be loaded');
	});
});

describe('leaking nothing', () => {
	it('keeps the upstream out of an error response', async () => {
		vi.mocked(resolveWishlist).mockRejectedValue(
			new Error('CS2Cap GET /items failed: 429 rate limited, key cs2cap_live_secret')
		);

		const { body } = await post({ items: [identity()] });

		expect(body).toEqual({ error: 'Your wishlist could not be loaded' });
		expect(JSON.stringify(body)).not.toMatch(/cs2cap|429|secret|rate limited/i);
	});

	it('says nothing about which field was wrong', async () => {
		const { body } = await post({ items: [identity({ itemId: 1 })] });

		expect(body).toEqual({ error: 'Invalid wishlist' });
	});
});
