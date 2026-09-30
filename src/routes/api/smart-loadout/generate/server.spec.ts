import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { MAX_BUDGET_MINOR } from '$lib/schemas/smart-loadout';
import type { SmartGenerationResult } from '$lib/types/smart-loadout';

// The endpoint's job is validation and shaping; the generator has its own
// tests and is never reached from an invalid request.
vi.mock('$lib/server/services/smart-loadout', () => ({ generateSmartLoadout: vi.fn() }));

const { generateSmartLoadout } = await import('$lib/server/services/smart-loadout');

const GENERATED: SmartGenerationResult = {
	status: 'generated',
	loadout: {
		preferences: { budgetMinor: 200_000, color: 'red', includeKnife: false, includeGloves: false },
		items: [
			{
				entryId: 't-rifle',
				slotId: 'ak-47',
				slotLabel: 'AK-47',
				skinSlug: 'ak-47-redline',
				weapon: 'AK-47',
				skinName: 'Redline',
				fullName: 'AK-47 | Redline',
				variant: { wear: 'Field-Tested', edition: 'normal' },
				priceMinor: 4250,
				currency: 'BRL',
				providerId: 'csfloat',
				providerName: 'CSFloat',
				match: 'color'
			}
		],
		selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }],
		totalMinor: 4250,
		budgetMinor: 200_000,
		remainingMinor: 195_750,
		currency: 'BRL',
		partialStyleMatch: false
	}
};

/** Calls the handler the way SvelteKit would. */
async function post(body: unknown, raw?: string) {
	const response = await POST({
		request: new Request('http://localhost/api/smart-loadout/generate', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: raw ?? JSON.stringify(body)
		}),
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof POST>[0]);

	return { status: response.status, body: await response.json() };
}

const VALID = { budgetMinor: 200_000, color: 'red', includeKnife: false, includeGloves: false };

beforeEach(() => {
	vi.mocked(generateSmartLoadout).mockReset();
	vi.mocked(generateSmartLoadout).mockResolvedValue(GENERATED);
});

describe('validation', () => {
	it('rejects a body that is not JSON', async () => {
		const { status, body } = await post(undefined, 'not json');

		expect(status).toBe(400);
		expect(body.error).toBe('Invalid request');
		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects a missing budget', async () => {
		expect((await post({ color: 'red' })).status).toBe(400);
		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects a budget that is not a positive integer', async () => {
		for (const budgetMinor of [0, -1, 1.5, '200000', null, Number.NaN]) {
			expect((await post({ ...VALID, budgetMinor })).status, String(budgetMinor)).toBe(400);
		}

		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects an absurd budget', async () => {
		expect((await post({ ...VALID, budgetMinor: MAX_BUDGET_MINOR + 1 })).status).toBe(400);
		expect((await post({ ...VALID, budgetMinor: MAX_BUDGET_MINOR })).status).toBe(200);
	});

	it('rejects a request with no visual direction', async () => {
		const { status, body } = await post({ budgetMinor: 200_000 });

		expect(status).toBe(400);
		expect(body.error).toBe('Invalid preferences');
		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects a colour outside the taxonomy', async () => {
		expect((await post({ ...VALID, color: 'burgundy' })).status).toBe(400);
		expect((await post({ ...VALID, color: 'RED' })).status).toBe(400);
		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects a style outside the taxonomy', async () => {
		expect((await post({ budgetMinor: 200_000, style: 'gothic' })).status).toBe(400);
		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('rejects a slot, a skin or an item id smuggled into the payload', async () => {
		// The whole point of the contract: preferences and nothing else.
		for (const extra of [
			{ slotId: 'ak-47' },
			{ itemIds: [1, 2, 3] },
			{ skinSlug: 'ak-47-redline' },
			{ candidates: 200 },
			{ limit: 500 }
		]) {
			const { status } = await post({ ...VALID, ...extra });

			expect(status, JSON.stringify(extra)).toBe(400);
		}

		expect(generateSmartLoadout).not.toHaveBeenCalled();
	});

	it('accepts a style on its own', async () => {
		expect((await post({ budgetMinor: 200_000, style: 'clean' })).status).toBe(200);
	});

	it('defaults the extras to off', async () => {
		await post({ budgetMinor: 200_000, color: 'red' });

		expect(generateSmartLoadout).toHaveBeenCalledWith(
			expect.objectContaining({ includeKnife: false, includeGloves: false }),
			expect.anything()
		);
	});

	it('passes the request through unchanged', async () => {
		await post({ budgetMinor: 123_456, color: 'blue', style: 'clean', includeKnife: true });

		expect(generateSmartLoadout).toHaveBeenCalledWith(
			{
				budgetMinor: 123_456,
				color: 'blue',
				style: 'clean',
				includeKnife: true,
				includeGloves: false
			},
			expect.anything()
		);
	});
});

describe('answering', () => {
	it('returns a generated loadout', async () => {
		const { status, body } = await post(VALID);

		expect(status).toBe(200);
		expect(body).toEqual(GENERATED);
	});

	it('generates once per request', async () => {
		await post(VALID);

		expect(generateSmartLoadout).toHaveBeenCalledTimes(1);
	});

	it('passes the event fetch through, so the server cache is used', async () => {
		await post(VALID);

		expect(vi.mocked(generateSmartLoadout).mock.calls[0][1]).toMatchObject({
			fetch: expect.any(Function)
		});
	});

	it('answers 200 for every failure reason — a reason is an answer', async () => {
		for (const reason of [
			'no-visual-candidates',
			'no-priceable-candidates',
			'budget-too-low',
			'market-unavailable'
		] as const) {
			vi.mocked(generateSmartLoadout).mockResolvedValue({ status: 'failed', reason });

			const { status, body } = await post(VALID);

			expect(status, reason).toBe(200);
			expect(body).toEqual({ status: 'failed', reason });
		}
	});

	it('carries the minimum through for a budget failure', async () => {
		vi.mocked(generateSmartLoadout).mockResolvedValue({
			status: 'failed',
			reason: 'budget-too-low',
			minimumMinor: 177_079,
			currency: 'BRL'
		});

		const { body } = await post(VALID);

		expect(body.minimumMinor).toBe(177_079);
		expect(body.currency).toBe('BRL');
	});

	it('returns 503 when the generator throws', async () => {
		vi.mocked(generateSmartLoadout).mockRejectedValue(new Error('catalog unavailable'));

		const { status, body } = await post(VALID);

		expect(status).toBe(503);
		expect(body.error).toBe('Smart Loadout is temporarily unavailable');
	});
});

describe('leaking nothing', () => {
	it('keeps the upstream out of an error response', async () => {
		vi.mocked(generateSmartLoadout).mockRejectedValue(
			new Error('CS2Cap POST /prices/batch failed: 429 rate limited, key cs2cap_live_secret')
		);

		const { body } = await post(VALID);

		// The thrown message in full, and nothing of it in the answer.
		expect(body).toEqual({ error: 'Smart Loadout is temporarily unavailable' });
		expect(JSON.stringify(body)).not.toMatch(/cs2cap|429|\/prices|secret|rate limited/i);
	});

	it('keeps catalog item ids out of a successful response', async () => {
		const { body } = await post(VALID);

		expect(JSON.stringify(body)).not.toContain('itemId');
	});

	it('says nothing about which field was wrong', async () => {
		// Validation detail is a map of the contract; the form already knows
		// what it sent.
		const { body } = await post({ ...VALID, budgetMinor: -5, color: 'burgundy' });

		expect(body).toEqual({ error: 'Invalid preferences' });
	});
});
