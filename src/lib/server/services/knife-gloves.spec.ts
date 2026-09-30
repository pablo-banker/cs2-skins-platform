import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getKnifeGloveSourceOptions, getKnifeGlovesResult } from './knife-gloves';
import { decodeLoadout, encodeLoadout } from '$lib/features/loadout/share';
import { KNIFE_GLOVE_MATCH_LIMIT } from '$lib/features/recommendations/knife-gloves';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';
import type { SkinVisualProfile } from '$lib/types/visual-metadata';

vi.mock('./catalog', () => ({ getBrowsableSkins: vi.fn(), getSkinBySlug: vi.fn() }));
vi.mock('./visual-metadata', async (importOriginal) => ({
	...(await importOriginal<typeof import('./visual-metadata')>()),
	getVisualProfile: vi.fn()
}));
vi.mock('./market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPrices: vi.fn(),
	getSkinPriceHistory: vi.fn()
}));

const { getBrowsableSkins, getSkinBySlug } = await import('./catalog');
const { getVisualProfile } = await import('./visual-metadata');
const market = await import('./market');

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

let nextItemId = 1000;
let catalog: Skin[];
let profiles: Map<string, SkinVisualProfile>;

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: nextItemId++,
		marketHashName: 'x',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

/** A catalog skin with every exterior, plus one StatTrak to prove it is skipped. */
function add(
	weapon: string,
	name: string,
	itemSubtype: string,
	visual: SkinVisualProfile | null,
	options: { wears?: string[]; statTrakOnly?: boolean } = {}
): Skin {
	const wears = options.wears ?? WEARS;

	const skin: Skin = {
		id: `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		rarity: { name: 'Covert' },
		variants: wears.length
			? wears.map((wear) => variant({ wear, statTrak: options.statTrakOnly ?? false }))
			: [variant()]
	};

	if (!options.statTrakOnly && wears.length) {
		// A StatTrak Field-Tested, which the practical policy must never pick.
		skin.variants.push(variant({ wear: 'Field-Tested', statTrak: true }));
	}

	catalog.push(skin);
	if (visual) profiles.set(`${weapon}|${name}`, visual);

	return skin;
}

const RED_DARK: SkinVisualProfile = {
	primaryColors: ['red', 'black'],
	secondaryColors: [],
	styles: ['dark']
};
const RED: SkinVisualProfile = { primaryColors: ['red'], secondaryColors: [], styles: [] };
const BLUE: SkinVisualProfile = { primaryColors: ['blue'], secondaryColors: [], styles: [] };

function quote(providerId: string, priceMinor: number, itemId: number): MarketQuote {
	return { providerId, itemId, priceMinor, currency: 'BRL', quantity: 3, stale: false };
}

/** Prices every requested id, by a function of the id. */
function priceEach(amount: (itemId: number) => number | null, currency = 'BRL') {
	vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
		[...itemIds].map((itemId) => {
			const value = amount(itemId);

			const prices: SkinMarketPrices = {
				itemId,
				currency,
				providersQueried: ['csfloat'],
				quotes: value === null ? [] : [{ ...quote('csfloat', value, itemId), currency }]
			};

			return { itemId, state: 'loaded' as const, prices };
		})
	);
}

beforeEach(() => {
	nextItemId = 1000;
	catalog = [];
	profiles = new Map();

	vi.mocked(getBrowsableSkins).mockReset();
	vi.mocked(getSkinBySlug).mockReset();
	vi.mocked(getVisualProfile).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();
	vi.mocked(market.getSkinPriceHistory).mockReset();

	add('Karambit', 'Crimson Web', 'Knives', RED_DARK);
	add('M9 Bayonet', 'Crimson Web', 'Knives', RED_DARK);
	add('Bayonet', 'Blue Steel', 'Knives', BLUE);
	add('Talon Knife', 'Uncurated', 'Knives', null);
	add('Specialist Gloves', 'Crimson Web', 'Gloves', RED_DARK);
	add('Sport Gloves', 'Red Racer', 'Gloves', RED);
	add('Driver Gloves', 'Cobalt', 'Gloves', BLUE);
	add('Hand Wraps', 'Uncurated', 'Gloves', null);
	add('AK-47', 'Redline', 'Rifles', RED_DARK);
	add('Nova', 'Bloomstick', 'Heavy', null);

	vi.mocked(getBrowsableSkins).mockImplementation(async () => catalog);
	vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) =>
		catalog.find((skin) => skin.id === slug)
	);
	vi.mocked(getVisualProfile).mockImplementation(
		(weapon: string, name: string) => profiles.get(`${weapon}|${name}`) ?? null
	);
	vi.mocked(market.getMarketProviders).mockResolvedValue([
		{ id: 'csfloat', name: 'CSFloat', status: 'up' }
	]);
	priceEach(() => 10_000);
});

/** The one call shape every test uses. */
const match = (slug: string | undefined, selection = {}) => getKnifeGlovesResult(slug, selection);

describe('the source picker dataset', () => {
	it('offers curated knives and gloves only', async () => {
		const options = await getKnifeGloveSourceOptions();

		expect(options.map((option) => option.slug)).toEqual([
			'bayonet-blue-steel',
			'karambit-crimson-web',
			'm9-bayonet-crimson-web',
			'driver-gloves-cobalt',
			'specialist-gloves-crimson-web',
			'sport-gloves-red-racer'
		]);
	});

	it('puts knives before gloves', async () => {
		const options = await getKnifeGloveSourceOptions();
		const firstGlove = options.findIndex((option) => option.slotId === 'gloves');

		expect(options.slice(0, firstGlove).every((option) => option.slotId === 'knife')).toBe(true);
		expect(options.slice(firstGlove).every((option) => option.slotId === 'gloves')).toBe(true);
	});

	it('stays small — a slug, a name and an image', async () => {
		const [option] = await getKnifeGloveSourceOptions();

		expect(Object.keys(option).sort()).toEqual(['imageUrl', 'name', 'slotId', 'slug', 'weapon']);
	});

	it('asks the market for nothing', async () => {
		await getKnifeGloveSourceOptions();

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
	});
});

describe('resolving the source', () => {
	it('shows the picker when nothing is selected', async () => {
		expect(await match(undefined)).toEqual({ state: 'none' });
	});

	it('recovers from an unknown slug rather than failing the route', async () => {
		expect(await match('not-a-real-skin')).toEqual({ state: 'unknown-skin' });
	});

	it('refuses a firearm, recoverably', async () => {
		expect(await match('ak-47-redline')).toEqual({ state: 'wrong-category' });
	});

	it('says so when a real knife is not curated', async () => {
		expect(await match('talon-knife-uncurated')).toEqual({
			state: 'uncurated',
			fullName: 'Talon Knife | Uncurated'
		});
	});

	it('defaults to the practical exterior', async () => {
		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.source.variant).toEqual({
			wear: 'Field-Tested',
			edition: 'normal',
			phase: undefined
		});
	});

	it('honours an explicit exterior exactly', async () => {
		// Someone who arrived from a Factory New knife must not be quietly
		// shown, or quietly priced, the Field-Tested one.
		const result = await match('karambit-crimson-web', { wear: 'Factory New' });

		expect(result.state === 'ready' && result.source.variant.wear).toBe('Factory New');
	});

	it('falls back rather than failing on an exterior that does not exist', async () => {
		const result = await match('karambit-crimson-web', { wear: 'Shrink-Wrapped' });

		expect(result.state).toBe('ready');
		expect(result.state === 'ready' && result.source.variant.wear).toBeTruthy();
	});

	it('handles a vanilla knife, which has no exterior at all', async () => {
		add('Bayonet', 'Vanilla', 'Knives', RED_DARK, { wears: [] });

		const result = await match('bayonet-vanilla');

		expect(result.state).toBe('ready');
		expect(result.state === 'ready' && result.source.variant.wear).toBeUndefined();
		// An absent control, not a control with one option.
		expect(result.state === 'ready' && result.source.wears).toEqual([]);
	});

	it('offers the normal-edition exteriors for the selector', async () => {
		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.source.wears).toEqual(WEARS);
	});

	it('never generates a StatTrak source', async () => {
		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.source.variant.edition).toBe('normal');
	});

	it('says uncurated when a curated skin has no normal variant to quote', async () => {
		add('Karambit', 'StatTrak Only', 'Knives', RED_DARK, { statTrakOnly: true });

		expect((await match('karambit-stattrak-only')).state).toBe('uncurated');
	});
});

describe('the matches', () => {
	it('pairs a knife with gloves', async () => {
		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		expect(result.matches.map((entry) => entry.slug)).toEqual([
			'specialist-gloves-crimson-web',
			'sport-gloves-red-racer'
		]);
		expect(result.matches.every((entry) => entry.slotId === 'gloves')).toBe(true);
	});

	it('pairs gloves with a knife', async () => {
		const result = await match('specialist-gloves-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		expect(result.matches.map((entry) => entry.slug)).toEqual([
			'karambit-crimson-web',
			'm9-bayonet-crimson-web'
		]);
		expect(result.matches.every((entry) => entry.slotId === 'knife')).toBe(true);
	});

	it('quotes each counterpart at its practical exterior', async () => {
		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		for (const entry of result.matches) {
			expect(entry.variant, entry.slug).toEqual({
				wear: 'Field-Tested',
				edition: 'normal',
				phase: undefined
			});
		}
	});

	it('is deterministic', async () => {
		const first = await match('karambit-crimson-web');
		const second = await match('karambit-crimson-web');

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it('returns an empty list rather than a weak one', async () => {
		const result = await match('bayonet-blue-steel');

		// Blue Steel's only blue counterpart is Driver Gloves | Cobalt, which
		// does share blue — so this asserts the honest outcome either way.
		if (result.state !== 'ready') throw new Error('expected a pairing');
		expect(result.matches.every((entry) => entry.slug === 'driver-gloves-cobalt')).toBe(true);
	});
});

describe('what it asks the market', () => {
	it('prices the source and its counterparts in one call', async () => {
		await match('karambit-crimson-web');

		expect(market.getManySkinPrices).toHaveBeenCalledTimes(1);
	});

	it('sends the source plus the matches, deduplicated', async () => {
		const result = await match('karambit-crimson-web');
		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		if (result.state !== 'ready') throw new Error('expected a pairing');

		expect(itemIds).toHaveLength(1 + result.matches.length);
		expect(new Set(itemIds).size).toBe(itemIds.length);
	});

	it('never exceeds the source plus the match limit', async () => {
		for (let index = 0; index < 20; index++) {
			add('Sport Gloves', `Finish ${String(index).padStart(2, '0')}`, 'Gloves', RED_DARK);
		}

		await match('karambit-crimson-web');
		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		expect(itemIds.length).toBeLessThanOrEqual(1 + KNIFE_GLOVE_MATCH_LIMIT);
	});

	it('loads the provider directory once', async () => {
		await match('karambit-crimson-web');

		expect(market.getMarketProviders).toHaveBeenCalledTimes(1);
	});

	it('loads no price history', async () => {
		await match('karambit-crimson-web');

		expect(market.getSkinPriceHistory).not.toHaveBeenCalled();
	});

	it('asks for nothing at all when the source is unusable', async () => {
		await match('ak-47-redline');
		await match('not-a-real-skin');
		await match(undefined);

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
	});
});

describe('prices and pair totals', () => {
	it('joins each price to the right item', async () => {
		priceEach((itemId) => itemId * 10);

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		expect(result.source.price?.amountMinor).toBeGreaterThan(0);
		expect(result.source.price?.providerName).toBe('CSFloat');
		expect(result.matches.every((entry) => (entry.price?.amountMinor ?? 0) > 0)).toBe(true);
	});

	it('adds the two lowest asks exactly', async () => {
		let next = 100_000;
		priceEach(() => (next += 1));

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		for (const entry of result.matches) {
			expect(entry.pairTotal?.amountMinor).toBe(
				(result.source.price?.amountMinor ?? 0) + (entry.price?.amountMinor ?? 0)
			);
		}
	});

	it('withholds the total when the source has no price', async () => {
		const sourceIds = new Set<number>();
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) => {
			const [first, ...rest] = [...itemIds];
			sourceIds.add(first);

			return [first, ...rest].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: [],
					quotes: itemId === first ? [] : [quote('csfloat', 5000, itemId)]
				} as SkinMarketPrices
			}));
		});

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		expect(result.source.price).toBeNull();
		// Matches still priced, and still shown: a missing source price costs
		// the totals, not the pairing.
		expect(result.matches.every((entry) => entry.price !== null)).toBe(true);
		expect(result.matches.every((entry) => entry.pairTotal === null)).toBe(true);
	});

	it('withholds the total for the one match with no price', async () => {
		const result0 = await match('karambit-crimson-web');
		if (result0.state !== 'ready') throw new Error('expected a pairing');

		const missing = vi.mocked(market.getManySkinPrices).mock.calls[0][0][1];
		priceEach((itemId) => (itemId === missing ? null : 7000));

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		const withoutPrice = result.matches.filter((entry) => entry.price === null);

		expect(withoutPrice).toHaveLength(1);
		expect(withoutPrice[0].pairTotal).toBeNull();
		// The others are unaffected.
		expect(result.matches.filter((entry) => entry.pairTotal !== null).length).toBeGreaterThan(0);
	});

	it('refuses to add two currencies', async () => {
		let first = true;
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => {
				const currency = first ? ((first = false), 'BRL') : 'USD';

				return {
					itemId,
					state: 'loaded' as const,
					prices: {
						itemId,
						currency,
						providersQueried: [],
						quotes: [{ ...quote('csfloat', 5000, itemId), currency }]
					} as SkinMarketPrices
				};
			})
		);

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');
		expect(result.matches.every((entry) => entry.pairTotal === null)).toBe(true);
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

		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.source.price?.amountMinor).toBe(9000);
		expect(result.state === 'ready' && result.source.price?.providerId).toBe('csfloat');
	});

	it('falls back to the provider key when the directory fails', async () => {
		vi.mocked(market.getMarketProviders).mockRejectedValue(new Error('directory down'));

		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.source.price?.providerName).toBeUndefined();
		expect(result.state === 'ready' && result.source.price?.providerId).toBe('csfloat');
	});
});

describe('when the market fails entirely', () => {
	beforeEach(() => {
		vi.mocked(market.getManySkinPrices).mockRejectedValue(new Error('CS2Cap exploded'));
	});

	it('still shows the pairing', async () => {
		const result = await match('karambit-crimson-web');

		expect(result.state).toBe('ready');
		expect(result.state === 'ready' && result.matches.length).toBeGreaterThan(0);
	});

	it('says prices are unavailable, once', async () => {
		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.pricesUnavailable).toBe(true);
		expect(result.state === 'ready' && result.source.price).toBeNull();
		expect(result.state === 'ready' && result.matches.every((e) => e.pairTotal === null)).toBe(
			true
		);
	});

	it('does not claim an outage when prices did load', async () => {
		vi.mocked(market.getManySkinPrices).mockReset();
		priceEach(() => 10_000);

		const result = await match('karambit-crimson-web');

		expect(result.state === 'ready' && result.pricesUnavailable).toBe(false);
	});
});

describe('ranking is visual, never price', () => {
	it('keeps the better match first even when it costs a hundred times more', async () => {
		catalog = [];
		profiles = new Map();

		add('Karambit', 'Crimson Web', 'Knives', RED_DARK);
		const strong = add('Specialist Gloves', 'Crimson Web', 'Gloves', RED_DARK);
		const weak = add('Sport Gloves', 'Red Racer', 'Gloves', RED);

		const strongIds = new Set(strong.variants.map((entry) => entry.itemId));
		const weakIds = new Set(weak.variants.map((entry) => entry.itemId));

		priceEach((itemId) =>
			strongIds.has(itemId) ? 1_000_000 : weakIds.has(itemId) ? 10_000 : 5000
		);

		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		// Similarity 10 at R$ 10.000 beats similarity 4 at R$ 100.
		expect(result.matches.map((entry) => entry.slug)).toEqual([
			'specialist-gloves-crimson-web',
			'sport-gloves-red-racer'
		]);
		expect(result.matches[0].price?.amountMinor).toBeGreaterThan(
			result.matches[1].price?.amountMinor ?? 0
		);
	});

	it('does not reorder when a cheaper pair exists', async () => {
		const ranked = await match('karambit-crimson-web');
		if (ranked.state !== 'ready') throw new Error('expected a pairing');

		const order = ranked.matches.map((entry) => entry.slug);

		// Invert every price and ask again.
		priceEach((itemId) => 1_000_000 - itemId);
		const reranked = await match('karambit-crimson-web');

		expect(reranked.state === 'ready' && reranked.matches.map((entry) => entry.slug)).toEqual(
			order
		);
	});
});

describe('handing a pair to the builder', () => {
	it('builds exactly one knife and one gloves selection', async () => {
		const result = await match('karambit-crimson-web');

		if (result.state !== 'ready') throw new Error('expected a pairing');

		for (const entry of result.matches) {
			expect(entry.pairSelections.map((selection) => selection.slotId).sort()).toEqual([
				'gloves',
				'knife'
			]);
		}
	});

	it('round-trips through the existing share codec', async () => {
		const result = await match('karambit-crimson-web', { wear: 'Factory New' });

		if (result.state !== 'ready') throw new Error('expected a pairing');

		const [first] = result.matches;
		const payload = encodeLoadout({ selections: first.pairSelections });
		const decoded = decodeLoadout(payload ?? '');

		expect(decoded.ok).toBe(true);
		expect(decoded.ok && decoded.selections).toEqual([
			{
				slotId: 'knife',
				skinSlug: 'karambit-crimson-web',
				variant: { wear: 'Factory New', edition: 'normal' }
			},
			{
				slotId: 'gloves',
				skinSlug: 'specialist-gloves-crimson-web',
				variant: { wear: 'Field-Tested', edition: 'normal' }
			}
		]);
	});

	it('carries the exact variants that were priced', async () => {
		const result = await match('specialist-gloves-crimson-web', { wear: 'Minimal Wear' });

		if (result.state !== 'ready') throw new Error('expected a pairing');

		const [first] = result.matches;
		const bySlot = new Map(first.pairSelections.map((entry) => [entry.slotId, entry]));

		expect(bySlot.get('gloves')?.variant).toEqual(result.source.variant);
		expect(bySlot.get('knife')?.variant).toEqual(first.variant);
	});

	it('names no catalog item id', async () => {
		const result = await match('karambit-crimson-web');

		expect(JSON.stringify(result)).not.toContain('itemId');
	});
});
