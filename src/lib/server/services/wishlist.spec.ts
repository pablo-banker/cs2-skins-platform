import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveWishlist } from './wishlist';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';

vi.mock('./catalog', () => ({ getSkinBySlug: vi.fn() }));
vi.mock('./market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPrices: vi.fn(),
	getSkinPriceHistory: vi.fn()
}));

const { getSkinBySlug } = await import('./catalog');
const market = await import('./market');

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

let nextItemId = 1000;
let catalog: Skin[];

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: nextItemId++,
		marketHashName: 'x',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

function add(weapon: string, name: string, options: { wears?: string[] } = {}): Skin {
	const wears = options.wears ?? WEARS;

	const skin: Skin = {
		id: `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype: 'Rifles',
		rarity: { name: 'Classified' },
		variants: wears.length ? wears.map((wear) => variant({ wear })) : [variant()]
	};

	if (wears.length) skin.variants.push(variant({ wear: 'Field-Tested', statTrak: true }));

	catalog.push(skin);

	return skin;
}

function quote(providerId: string, priceMinor: number, itemId: number): MarketQuote {
	return { providerId, itemId, priceMinor, currency: 'BRL', quantity: 4, stale: false };
}

function priceEach(amount: (itemId: number) => number | null) {
	vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
		[...itemIds].map((itemId) => {
			const value = amount(itemId);

			return {
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: ['csfloat'],
					quotes: value === null ? [] : [quote('csfloat', value, itemId)]
				} as SkinMarketPrices
			};
		})
	);
}

beforeEach(() => {
	nextItemId = 1000;
	catalog = [];

	vi.mocked(getSkinBySlug).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();
	vi.mocked(market.getSkinPriceHistory).mockReset();

	add('AK-47', 'Redline');
	add('AWP', 'Asiimov');
	add('Bayonet', 'Vanilla', { wears: [] });

	vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
		catalog.find((skin) => skin.id === slug)
	);
	vi.mocked(market.getMarketProviders).mockResolvedValue([
		{ id: 'csfloat', name: 'CSFloat', status: 'up' }
	]);
	priceEach(() => 13_006);
});

const redlineFT = { skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } };
const redlineMW = { skinSlug: 'ak-47-redline', variant: { wear: 'Minimal Wear' } };

describe('resolving exact variants', () => {
	it('returns current catalog data for a saved item', async () => {
		const { items } = await resolveWishlist([redlineFT]);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			skinSlug: 'ak-47-redline',
			weapon: 'AK-47',
			name: 'Redline',
			fullName: 'AK-47 | Redline',
			variant: { wear: 'Field-Tested', edition: 'normal' }
		});
	});

	it('keeps two exteriors of one skin apart', async () => {
		const { items } = await resolveWishlist([redlineFT, redlineMW]);

		expect(items.map((entry) => entry.variant.wear)).toEqual(['Field-Tested', 'Minimal Wear']);
		expect(new Set(items.map((entry) => entry.key)).size).toBe(2);
	});

	it('carries a key the browser can match its own entries against', async () => {
		const { items } = await resolveWishlist([redlineFT]);

		expect(items[0].key).toBe('ak-47-redline|Field-Tested||');
	});

	it('resolves a vanilla knife, which has no exterior', async () => {
		const { items } = await resolveWishlist([{ skinSlug: 'bayonet-vanilla', variant: {} }]);

		expect(items).toHaveLength(1);
		expect(items[0].variant.wear).toBeUndefined();
	});

	it('echoes the variant from the catalog, not from the request', async () => {
		const { items } = await resolveWishlist([
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested', edition: 'normal' } }
		]);

		expect(items[0].variant).toEqual({
			wear: 'Field-Tested',
			edition: 'normal',
			phase: undefined
		});
	});

	it('returns nothing for an empty wishlist, and asks the market nothing', async () => {
		expect(await resolveWishlist([])).toEqual({ items: [], rejected: [] });
		expect(market.getManySkinPrices).not.toHaveBeenCalled();
	});
});

describe('catalog evolution', () => {
	it('rejects a skin that is no longer in the catalog', async () => {
		const { items, rejected } = await resolveWishlist([{ skinSlug: 'gone-forever', variant: {} }]);

		expect(items).toEqual([]);
		expect(rejected).toEqual([
			{ key: 'gone-forever|||', skinSlug: 'gone-forever', reason: 'unknown-skin' }
		]);
	});

	it('rejects an exterior that no longer exists rather than substituting one', async () => {
		// `resolveVariant` would happily fall back. A wishlist entry is an
		// exact choice, and a different exterior is a different price.
		const { items, rejected } = await resolveWishlist([
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Shrink-Wrapped' } }
		]);

		expect(items).toEqual([]);
		expect(rejected[0].reason).toBe('invalid-variant');
	});

	it('rejects an edition that no longer exists', async () => {
		const { rejected } = await resolveWishlist([
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested', edition: 'souvenir' } }
		]);

		expect(rejected[0].reason).toBe('invalid-variant');
	});

	it('loses one item, not the whole list', async () => {
		const { items, rejected } = await resolveWishlist([
			redlineFT,
			{ skinSlug: 'gone-forever', variant: {} },
			{ skinSlug: 'awp-asiimov', variant: { wear: 'Factory New' } }
		]);

		expect(items.map((entry) => entry.skinSlug)).toEqual(['ak-47-redline', 'awp-asiimov']);
		expect(rejected).toHaveLength(1);
	});

	it('still prices what survived', async () => {
		const { items } = await resolveWishlist([{ skinSlug: 'gone', variant: {} }, redlineFT]);

		expect(items[0].priceState).toBe('priced');
	});
});

describe('current prices', () => {
	it('reports the cheapest usable quote and its marketplace', async () => {
		const { items } = await resolveWishlist([redlineFT]);

		expect(items[0]).toMatchObject({
			priceState: 'priced',
			currentPriceMinor: 13_006,
			currency: 'BRL',
			providerId: 'csfloat',
			providerName: 'CSFloat'
		});
	});

	it('falls back to the provider key when the directory fails', async () => {
		vi.mocked(market.getMarketProviders).mockRejectedValue(new Error('directory down'));

		const { items } = await resolveWishlist([redlineFT]);

		expect(items[0].providerId).toBe('csfloat');
		expect(items[0].providerName).toBeUndefined();
	});

	it('ignores stale and non-positive quotes', async () => {
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: [],
					quotes: [
						{ ...quote('ghost', 1, itemId), stale: true },
						quote('broken', 0, itemId),
						quote('csfloat', 9000, itemId)
					]
				} as SkinMarketPrices
			}))
		);

		const { items } = await resolveWishlist([redlineFT]);

		expect(items[0].currentPriceMinor).toBe(9000);
	});

	it('separates "nothing listed" from "could not ask"', async () => {
		const ids: number[] = [];

		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) => {
			ids.push(...itemIds);

			return [...itemIds].map((itemId, index) =>
				index === 0
					? {
							itemId,
							state: 'loaded' as const,
							prices: {
								itemId,
								currency: 'BRL',
								providersQueried: [],
								quotes: []
							} as SkinMarketPrices
						}
					: { itemId, state: 'error' as const, prices: null }
			);
		});

		const { items } = await resolveWishlist([redlineFT, redlineMW]);

		// Two different truths, kept apart: nobody is selling it, versus we
		// could not find out.
		expect(items[0].priceState).toBe('unpriced');
		expect(items[1].priceState).toBe('error');
		expect(items.every((entry) => entry.currentPriceMinor === undefined)).toBe(true);
	});

	it('keeps every item when the whole market fails', async () => {
		vi.mocked(market.getManySkinPrices).mockRejectedValue(new Error('CS2Cap exploded'));

		const { items } = await resolveWishlist([redlineFT, redlineMW]);

		// Losing prices must not lose the list — the identities are still
		// correct and still worth showing.
		expect(items).toHaveLength(2);
		expect(items.every((entry) => entry.priceState === 'error')).toBe(true);
	});

	it('does not let one item losing its price affect another', async () => {
		let first = true;
		priceEach(() => (first ? ((first = false), null) : 20_000));

		const { items } = await resolveWishlist([redlineFT, redlineMW]);

		expect(items[0].priceState).toBe('unpriced');
		expect(items[1].currentPriceMinor).toBe(20_000);
	});
});

describe('what it asks the market', () => {
	it('prices everything in one call', async () => {
		await resolveWishlist([redlineFT, redlineMW, { skinSlug: 'awp-asiimov', variant: {} }]);

		expect(market.getManySkinPrices).toHaveBeenCalledTimes(1);
		expect(vi.mocked(market.getManySkinPrices).mock.calls[0][0]).toHaveLength(3);
	});

	it('loads the provider directory once', async () => {
		await resolveWishlist([redlineFT, redlineMW]);

		expect(market.getMarketProviders).toHaveBeenCalledTimes(1);
	});

	it('loads no price history, ever', async () => {
		await resolveWishlist([redlineFT, redlineMW, { skinSlug: 'awp-asiimov', variant: {} }]);

		expect(market.getSkinPriceHistory).not.toHaveBeenCalled();
	});

	it('asks for nothing when everything was rejected', async () => {
		await resolveWishlist([{ skinSlug: 'gone', variant: {} }]);

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
	});
});

describe('what it never returns', () => {
	it('keeps catalog item ids out of the response', async () => {
		const resolution = await resolveWishlist([redlineFT]);

		expect(JSON.stringify(resolution)).not.toMatch(/itemId|marketHashName/);
	});

	it('returns one price per item, not every marketplace', async () => {
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: [],
					quotes: [
						quote('csfloat', 13_006, itemId),
						quote('steam', 15_000, itemId),
						quote('skinport', 14_000, itemId)
					]
				} as SkinMarketPrices
			}))
		);

		const { items } = await resolveWishlist([redlineFT]);

		// Full comparison is the skin page's job.
		expect(JSON.stringify(items)).not.toContain('steam');
		expect(items[0].currentPriceMinor).toBe(13_006);
	});

	it('never carries the add-time snapshot, which it was never told', async () => {
		const resolution = await resolveWishlist([redlineFT]);

		expect(JSON.stringify(resolution)).not.toMatch(/addedAt|addedPriceMinor/);
	});
});
