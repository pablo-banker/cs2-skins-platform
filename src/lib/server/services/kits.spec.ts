import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getEditorialKitBySlug,
	getEditorialKits,
	getResolvedKitBySlug,
	KitResolutionError,
	resolveKit
} from './kits';
import { editorialKitsFileSchema } from '$lib/schemas/kit';
import { WEAR_ORDER } from '$lib/schemas/skin-detail';
import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';
import kitsFile from '$lib/data/editorial-kits.json';
import type { EditorialKit } from '$lib/types/kit';
import type { Skin, SkinVariant } from '$lib/types/skin';

// The catalog is mocked: the resolver's job is joining our editorial data to
// whatever the catalog returns, and nothing here should touch the network.
vi.mock('./catalog', () => ({ getSkinBySlug: vi.fn() }));

const { getSkinBySlug } = await import('./catalog');

function variant(wear: string, overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: wear.length * 1000 + (overrides.statTrak ? 1 : 0),
		marketHashName: `Test | Skin (${wear})`,
		wear,
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

function skin(id: string, variants: SkinVariant[] = [variant('Field-Tested')]): Skin {
	return {
		id,
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		variants
	};
}

function kit(overrides: Partial<EditorialKit> = {}): EditorialKit {
	return {
		slug: 'test-kit',
		name: 'Test Kit',
		description: 'A kit that exists only in this test file.',
		category: 'color',
		tags: ['red'],
		items: [{ skinSlug: 'one' }, { skinSlug: 'two' }, { skinSlug: 'three' }],
		...overrides
	};
}

beforeEach(() => {
	vi.mocked(getSkinBySlug).mockReset();
});

describe('resolveKit', () => {
	it('resolves every reference to a catalog skin, in editorial order', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) => skin(slug));

		const resolved = await resolveKit(kit());

		expect(resolved.items.map((item) => item.skin.id)).toEqual(['one', 'two', 'three']);
	});

	it('carries the kit metadata through unchanged', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) => skin(slug));

		const resolved = await resolveKit(kit());

		expect(resolved.slug).toBe('test-kit');
		expect(resolved.name).toBe('Test Kit');
		expect(resolved.category).toBe('color');
		expect(resolved.tags).toEqual(['red']);
	});

	it('fails when the catalog has no such skin', async () => {
		vi.mocked(getSkinBySlug).mockResolvedValue(undefined);

		await expect(resolveKit(kit())).rejects.toBeInstanceOf(KitResolutionError);
		await expect(resolveKit(kit())).rejects.toThrow('no catalog skin for "one"');
	});

	it('resolves the exact preferred variant', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
			skin(slug, [variant('Factory New'), variant('Field-Tested'), variant('Battle-Scarred')])
		);

		const resolved = await resolveKit(
			kit({ items: [{ skinSlug: 'one', variant: { wear: 'Battle-Scarred' } }] })
		);

		expect(resolved.items[0].variant.wear).toBe('Battle-Scarred');
	});

	it('resolves a preferred phase exactly', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
			skin(slug, [
				variant('Factory New', { itemId: 1, phase: 'Phase 1' }),
				variant('Factory New', { itemId: 2, phase: 'Phase 4' })
			])
		);

		const resolved = await resolveKit(
			kit({ items: [{ skinSlug: 'one', variant: { wear: 'Factory New', phase: 'Phase 4' } }] })
		);

		expect(resolved.items[0].variant.phase).toBe('Phase 4');
	});

	it('fails rather than substituting when the preferred wear does not exist', async () => {
		// A kit priced on Factory New must never quietly become Battle-Scarred.
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
			skin(slug, [variant('Battle-Scarred')])
		);

		await expect(
			resolveKit(kit({ items: [{ skinSlug: 'one', variant: { wear: 'Factory New' } }] }))
		).rejects.toThrow('has no Factory New variant');
	});

	it('fails rather than substituting when the preferred phase does not exist', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
			skin(slug, [variant('Factory New', { phase: 'Phase 1' })])
		);

		await expect(
			resolveKit(
				kit({ items: [{ skinSlug: 'one', variant: { wear: 'Factory New', phase: 'Ruby' } }] })
			)
		).rejects.toThrow('has no Ruby variant');
	});

	it('fails when a catalog skin carries no variants at all', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) => skin(slug, []));

		await expect(resolveKit(kit())).rejects.toThrow('has no variants');
	});

	it('falls back to the representative variant when the kit states no preference', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
			skin(slug, [variant('Battle-Scarred'), variant('Minimal Wear')])
		);

		const resolved = await resolveKit(kit({ items: [{ skinSlug: 'one' }] }));

		expect(resolved.items[0].variant.wear).toBe('Minimal Wear');
	});

	it('does not mutate the kit it was given', async () => {
		vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) => skin(slug));

		const source = kit();
		const snapshot = structuredClone(source);

		await resolveKit(source);

		expect(source).toEqual(snapshot);
	});

	it('names the kit in every resolution failure', async () => {
		vi.mocked(getSkinBySlug).mockResolvedValue(undefined);

		await expect(resolveKit(kit({ slug: 'crimson' }))).rejects.toThrow('Kit "crimson"');
	});
});

describe('getResolvedKitBySlug', () => {
	it('returns undefined for a slug no kit uses', async () => {
		await expect(getResolvedKitBySlug('not-a-kit')).resolves.toBeUndefined();
		expect(getSkinBySlug).not.toHaveBeenCalled();
	});
});

/**
 * The listing stays editorial.
 *
 * `/kits` renders four kits, and pricing them would mean pricing every item of
 * every kit for a page nobody has chosen anything on yet. Live pricing belongs
 * to the kit a visitor actually opened.
 *
 * Checked against the sources because the failure it prevents is an *import*.
 */
describe('/kits costs no market request', () => {
	const marketSymbols = [
		'services/market',
		'getSkinPrices',
		'getManySkinPrices',
		'getSkinPriceHistory',
		'getMarketProviders'
	];

	it('the kit service never reaches for market data', () => {
		const service = readFileSync('src/lib/server/services/kits.ts', 'utf8');

		for (const symbol of marketSymbols) expect(service).not.toContain(symbol);
	});

	it('the listing loader never reaches for market data', () => {
		const loader = readFileSync('src/routes/kits/+page.server.ts', 'utf8');

		for (const symbol of marketSymbols) expect(loader).not.toContain(symbol);
	});

	it('the kit card never reaches for market data', () => {
		const card = readFileSync('src/lib/components/kit/KitCard.svelte', 'utf8');

		for (const symbol of marketSymbols) expect(card).not.toContain(symbol);
		// Nor a placeholder implying a price is on its way.
		expect(card).not.toMatch(/Skeleton|priceMinor|PriceDisplay/);
	});
});

/**
 * The shipped dataset, checked as content.
 *
 * Everything here is verifiable without the catalog. Whether each referenced
 * skin and variant really exists upstream is an integration question — the
 * resolver raises `KitResolutionError` for it at request time, and
 * `docs/KITS.md` records how that was verified against the live catalog.
 */
describe('editorial-kits.json', () => {
	const kits = getEditorialKits();
	const wears = new Set<string>(WEAR_ORDER);
	const vocabulary = new Set<string>([...SKIN_COLORS, ...SKIN_STYLES]);

	it('is valid against the schema', () => {
		const parsed = editorialKitsFileSchema.safeParse(kitsFile);

		expect(parsed.error?.issues ?? []).toEqual([]);
		expect(parsed.success).toBe(true);
	});

	it('ships kits', () => {
		expect(kits.length).toBeGreaterThan(0);
	});

	it('has unique slugs and unique names', () => {
		expect(new Set(kits.map((entry) => entry.slug)).size).toBe(kits.length);
		expect(new Set(kits.map((entry) => entry.name)).size).toBe(kits.length);
	});

	it('names every skin by a route slug, never an upstream id', () => {
		for (const entry of kits) {
			for (const item of entry.items) {
				expect(item.skinSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
				expect(item.skinSlug).not.toMatch(/^\d+$/);
			}
		}
	});

	it('only ever prefers a real CS2 exterior', () => {
		for (const entry of kits) {
			for (const item of entry.items) {
				if (item.variant?.wear) expect(wears).toContain(item.variant.wear);
			}
		}
	});

	it('tags every kit from the shared visual vocabulary', () => {
		for (const entry of kits) {
			for (const tag of entry.tags) expect(vocabulary).toContain(tag);
		}
	});

	it('gives every kit at least four items, so its cover collage is full', () => {
		// The card renders the first four items in a 2×2 grid; three would
		// leave a visible hole.
		for (const entry of kits) expect(entry.items.length).toBeGreaterThanOrEqual(4);
	});

	it('carries editorial fields only — no market data', () => {
		// A total or a currency committed to this file is stale before the
		// commit lands, so a kit is allowed exactly these keys.
		for (const entry of kits) {
			expect(Object.keys(entry).sort()).toEqual([
				'category',
				'description',
				'items',
				'name',
				'slug',
				'tags'
			]);

			for (const item of entry.items) {
				expect(Object.keys(item).sort()).toEqual(
					item.variant ? ['skinSlug', 'variant'] : ['skinSlug']
				);
			}
		}
	});

	it('is reachable by slug', () => {
		for (const entry of kits) {
			expect(getEditorialKitBySlug(entry.slug)?.name).toBe(entry.name);
		}

		expect(getEditorialKitBySlug('not-a-kit')).toBeUndefined();
	});
});
