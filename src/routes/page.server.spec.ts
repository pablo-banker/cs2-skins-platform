import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import type { ResolvedKit } from '$lib/types/kit';

vi.mock('$lib/server/services/kits', () => ({ getResolvedKits: vi.fn() }));

const { getResolvedKits } = await import('$lib/server/services/kits');

function kit(slug: string): ResolvedKit {
	return {
		slug,
		name: slug,
		description: `About ${slug}`,
		category: 'color',
		tags: ['red'],
		items: []
	};
}

const ALL = ['crimson', 'monochrome', 'cobalt', 'verdant', 'midnight'].map(kit);

/**
 * Calls the loader the way SvelteKit would.
 *
 * The generated `load` type widens to include `void`, which it never is here —
 * narrowed once so every assertion below stays readable.
 */
const run = async (): Promise<{ kits: ResolvedKit[] }> =>
	(await load({ fetch: globalThis.fetch } as unknown as Parameters<typeof load>[0])) as {
		kits: ResolvedKit[];
	};

beforeEach(() => {
	vi.mocked(getResolvedKits).mockReset();
	vi.mocked(getResolvedKits).mockResolvedValue(ALL);
});

describe('what the homepage loads', () => {
	it('previews a few kits, in editorial order', async () => {
		const { kits } = await run();

		// Three: one desktop row, and a sample rather than a catalog.
		expect(kits.map((entry) => entry.slug)).toEqual(['crimson', 'monochrome', 'cobalt']);
	});

	it('takes fewer when fewer exist', async () => {
		vi.mocked(getResolvedKits).mockResolvedValue(ALL.slice(0, 2));

		expect((await run()).kits).toHaveLength(2);
	});

	it('loads the kits once', async () => {
		await run();

		expect(getResolvedKits).toHaveBeenCalledTimes(1);
	});
});

describe('when the kits cannot be resolved', () => {
	it('still renders the homepage, without a preview', async () => {
		// A secondary section failing is not a reason to 500 the front door.
		vi.mocked(getResolvedKits).mockRejectedValue(new Error('catalog unavailable'));

		await expect(run()).resolves.toEqual({ kits: [] });
	});
});

describe('what it costs', () => {
	it('imports no market service at all', () => {
		// The guarantee, not just the behaviour: a future edit that priced the
		// kit preview would pass every test above and fail this one.
		const source = readFileSync('src/routes/+page.server.ts', 'utf8');

		expect(source).not.toMatch(/services\/market/);
		expect(source).not.toMatch(/getSkinPrices|getManySkinPrices|getMarketProviders|PriceHistory/);
	});
});
