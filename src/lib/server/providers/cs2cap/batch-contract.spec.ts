import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MarketQuote } from '$lib/types/market';

/**
 * The batch integration against a running stub.
 *
 * Every other test in this folder hands the client a canned `Response`, which
 * proves the mapping but not the wire: that the request we build is one a
 * server accepts, and that a real HTTP round trip survives our schema. This
 * runs `e2e/mock-cs2cap.mjs` — the same stub the end-to-end suite uses, shaped
 * from the published OpenAPI contract — and talks to it over a socket.
 *
 * It also pins the property Phase 10 rests on: **transport does not change the
 * answer.** The same items priced individually and in one batch produce the
 * same quotes, so a deployment switching `CS2CAP_BATCH_PRICES_ENABLED` changes
 * how many requests are made and nothing a visitor can see.
 */
const PORT = 4187;

const { mockEnv } = vi.hoisted(() => ({
	mockEnv: {
		CS2CAP_API_KEY: 'contract-test-key',
		CS2CAP_BASE_URL: ''
	} as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { getQuotesForItem, getQuotesForItems } = await import('./prices');

let mock: ChildProcess;

async function waitForPort(): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			const response = await fetch(`http://localhost:${PORT}/v1/providers`);
			if (response.ok) return;
		} catch {
			// Not listening yet.
		}

		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	throw new Error(`mock cs2cap did not start on port ${PORT}`);
}

beforeAll(async () => {
	mockEnv.CS2CAP_BASE_URL = `http://localhost:${PORT}/v1`;

	mock = spawn('node', ['e2e/mock-cs2cap.mjs'], {
		env: { ...process.env, MOCK_CS2CAP_PORT: String(PORT) },
		stdio: 'ignore'
	});

	await waitForPort();
}, 30_000);

afterAll(() => {
	mock?.kill();
});

/** Item ids the stub's catalog is known to carry. */
const PRICED_IDS = [1004, 1031, 1052];

describe('POST /prices/batch against a live stub', () => {
	it('parses a real response into domain quotes', async () => {
		const sets = await getQuotesForItems({ itemIds: PRICED_IDS });

		expect(sets.map((set) => set.itemId)).toEqual(PRICED_IDS);

		for (const set of sets) {
			expect(set.currency).toBe('BRL');
			expect(set.quotes.length).toBeGreaterThan(0);
			expect(set.quotes[0].priceMinor).toBeGreaterThan(0);
			expect(Number.isInteger(set.quotes[0].priceMinor)).toBe(true);
		}
	});

	it('returns quotes cheapest first', async () => {
		const [set] = await getQuotesForItems({ itemIds: [PRICED_IDS[0]] });
		const prices = set.quotes.map((quote) => quote.priceMinor);

		expect(prices).toEqual([...prices].sort((a, b) => a - b));
	});

	it('carries no redirect, because the contract has no link field', async () => {
		const [set] = await getQuotesForItems({ itemIds: [PRICED_IDS[0]] });

		expect(set.quotes.every((quote) => quote.redirectUrl === undefined)).toBe(true);
	});

	it('answers for an item nothing is listed for', async () => {
		// The stub leaves one skin unpriced on purpose.
		const sets = await getQuotesForItems({ itemIds: [1097] });

		expect(sets).toHaveLength(1);
		expect(sets[0].quotes).toEqual([]);
	});

	it('surfaces the documented batch-size rejection', async () => {
		// Asked for directly, bypassing our own guard, so the upstream error
		// mapping is what is under test.
		const response = await fetch(`http://localhost:${PORT}/v1/prices/batch`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ item_ids: Array.from({ length: 101 }, (_, i) => i + 1000) })
		});

		expect(response.status).toBe(400);
	});
});

/** Everything a total depends on, without the two transport-dependent fields. */
function comparable(quote: MarketQuote): Partial<MarketQuote> {
	const rest: Partial<MarketQuote> = { ...quote };
	delete rest.redirectUrl;
	delete rest.updatedAt;

	return rest;
}

describe('transport equivalence over the wire', () => {
	it('gives the same quotes individually and in batch', async () => {
		const batched = await getQuotesForItems({ itemIds: PRICED_IDS });

		const individual = await Promise.all(PRICED_IDS.map((itemId) => getQuotesForItem({ itemId })));

		for (const [index, set] of batched.entries()) {
			const single = individual[index];

			expect(set.itemId).toBe(single.itemId);
			expect(set.currency).toBe(single.currency);
			// The redirect is the one documented difference. `updatedAt` is
			// dropped because the stub stamps it at request time, so the two
			// calls differ by a millisecond — a fixture artefact, not a
			// transport one. Everything that feeds a total must match exactly.
			expect(set.quotes.map(comparable)).toEqual(single.quotes.map(comparable));
		}
	});
});
