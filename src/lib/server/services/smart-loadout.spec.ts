import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	generateSmartLoadout,
	getSmartAvailability,
	SMART_CANDIDATES_PER_ENTRY,
	SMART_MAX_PRICED_CANDIDATES
} from './smart-loadout';
import { SMART_CORE } from '$lib/config/smart-loadout';
import { STEAM_PROVIDER_ID } from '$lib/features/prices/steam';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';
import type { SkinVisualProfile } from '$lib/types/visual-metadata';

// The catalog, the curated dataset and the market each have their own tests;
// this is about the pipeline between them.
vi.mock('./catalog', () => ({ getBrowsableSkins: vi.fn() }));
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

const { getBrowsableSkins } = await import('./catalog');
const { getVisualProfile } = await import('./visual-metadata');
const market = await import('./market');

let nextItemId = 1000;

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: nextItemId++,
		marketHashName: 'x',
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

function skin(weapon: string, name: string, itemSubtype = 'Rifles'): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		variants: [variant({ wear: 'Factory New' }), variant({ wear: 'Field-Tested' })]
	};
}

/** One curated skin for every required core slot, all red, some also dark. */
const RED: SkinVisualProfile = { primaryColors: ['red'], secondaryColors: [], styles: [] };
const RED_DARK: SkinVisualProfile = {
	primaryColors: ['red'],
	secondaryColors: [],
	styles: ['dark']
};
const BLUE: SkinVisualProfile = { primaryColors: ['blue'], secondaryColors: [], styles: [] };

const REQUIRED_SLOTS: [string, string, string][] = [
	['Glock-18', 'Candy Apple', 'Pistols'],
	['AK-47', 'Redline', 'Rifles'],
	['USP-S', 'Check Engine', 'Pistols'],
	['M4A1-S', 'Hot Rod', 'Rifles'],
	['Desert Eagle', 'Code Red', 'Pistols'],
	['AWP', 'Wildfire', 'Rifles']
];

let catalog: Skin[];
let profiles: Map<string, SkinVisualProfile>;

function addSkin(weapon: string, name: string, subtype: string, profile: SkinVisualProfile): Skin {
	const entry = skin(weapon, name, subtype);
	catalog.push(entry);
	profiles.set(`${weapon}|${name}`, profile);

	return entry;
}

function quote(providerId: string, priceMinor: number, itemId: number): MarketQuote {
	return { providerId, itemId, priceMinor, currency: 'BRL', quantity: 4, stale: false };
}

/** Prices every requested id at a stable amount derived from the id. */
function priceEverything(amount: (itemId: number) => number = () => 1000, withSteam = true) {
	vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
		[...itemIds].map((itemId) => {
			const quotes = [quote('csfloat', amount(itemId), itemId)];
			if (withSteam) quotes.push(quote(STEAM_PROVIDER_ID, amount(itemId) * 2, itemId));

			const prices: SkinMarketPrices = {
				itemId,
				currency: 'BRL',
				providersQueried: ['csfloat'],
				quotes,
				bestQuote: quotes[0]
			};

			return { itemId, state: 'loaded' as const, prices };
		})
	);
}

beforeEach(() => {
	nextItemId = 1000;
	catalog = [];
	profiles = new Map();

	for (const [weapon, name, subtype] of REQUIRED_SLOTS) addSkin(weapon, name, subtype, RED);

	vi.mocked(getBrowsableSkins).mockReset();
	vi.mocked(getVisualProfile).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();
	vi.mocked(market.getSkinPriceHistory).mockReset();

	vi.mocked(getBrowsableSkins).mockImplementation(async () => catalog);
	vi.mocked(getVisualProfile).mockImplementation(
		(weapon: string, name: string) => profiles.get(`${weapon}|${name}`) ?? null
	);
	vi.mocked(market.getMarketProviders).mockResolvedValue([
		{ id: 'csfloat', name: 'CSFloat', status: 'up' },
		{ id: STEAM_PROVIDER_ID, name: 'Steam', status: 'up' }
	]);
	priceEverything();
});

const RED_REQUEST = {
	budgetMinor: 1_000_000,
	color: 'red' as const,
	includeKnife: false,
	includeGloves: false
};

describe('generating a loadout', () => {
	it('fills every required core entry', async () => {
		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result.status).toBe('generated');
		expect(result.status === 'generated' && result.loadout.items).toHaveLength(6);
	});

	it('reports the total, the budget and what is left over', async () => {
		const result = await generateSmartLoadout({ ...RED_REQUEST, budgetMinor: 100_000 });

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.totalMinor).toBe(6000);
		expect(result.loadout.budgetMinor).toBe(100_000);
		expect(result.loadout.remainingMinor).toBe(94_000);
	});

	it('produces builder selections in application identity', async () => {
		const result = await generateSmartLoadout(RED_REQUEST);

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.selections[0]).toEqual({
			slotId: expect.any(String),
			skinSlug: expect.any(String),
			variant: { wear: 'Field-Tested', edition: 'normal', phase: undefined }
		});
		// No catalog id escapes to the builder handoff.
		expect(JSON.stringify(result.loadout.selections)).not.toContain('itemId');
	});

	it('prices the Field-Tested variant, not every exterior', async () => {
		await generateSmartLoadout(RED_REQUEST);

		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		// Six entries, one variant each.
		expect(itemIds).toHaveLength(6);
	});

	it('asks the market once', async () => {
		await generateSmartLoadout(RED_REQUEST);

		expect(market.getManySkinPrices).toHaveBeenCalledTimes(1);
		expect(market.getMarketProviders).toHaveBeenCalledTimes(1);
	});

	it('loads no price history', async () => {
		await generateSmartLoadout(RED_REQUEST);

		expect(market.getSkinPriceHistory).not.toHaveBeenCalled();
	});

	it('compares against Steam without another request', async () => {
		const result = await generateSmartLoadout(RED_REQUEST);

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.steam).toEqual({
			totalMinor: 12_000,
			currency: 'BRL',
			savingsMinor: 6000
		});
		expect(market.getManySkinPrices).toHaveBeenCalledTimes(1);
	});

	it('succeeds without Steam coverage', async () => {
		priceEverything(() => 1000, false);

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result.status).toBe('generated');
		expect(result.status === 'generated' && result.loadout.steam).toBeUndefined();
	});

	it('is deterministic', async () => {
		const first = await generateSmartLoadout(RED_REQUEST);
		const second = await generateSmartLoadout(RED_REQUEST);

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});
});

describe('the candidate shortlist', () => {
	it('never prices more than the configured cap', async () => {
		// Far more curated candidates than the shortlist allows.
		for (let index = 0; index < 40; index++) {
			addSkin('AK-47', `Red Finish ${index}`, 'Rifles', RED);
		}

		await generateSmartLoadout(RED_REQUEST);

		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		expect(itemIds.length).toBeLessThanOrEqual(SMART_MAX_PRICED_CANDIDATES);
		// Six per entry, not forty.
		expect(itemIds.length).toBeLessThanOrEqual(6 * SMART_CANDIDATES_PER_ENTRY);
	});

	it('prices each catalog item once, however many entries could use it', async () => {
		await generateSmartLoadout(RED_REQUEST);

		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		expect(new Set(itemIds).size).toBe(itemIds.length);
	});

	it('leaves uncurated skins out entirely', async () => {
		catalog.push(skin('AK-47', 'Uncurated', 'Rifles'));

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(JSON.stringify(result)).not.toContain('Uncurated');
	});
});

describe('colour and style', () => {
	it('prefers an exact colour-and-style match', async () => {
		addSkin('AK-47', 'Red Dark', 'Rifles', RED_DARK);

		const result = await generateSmartLoadout({ ...RED_REQUEST, style: 'dark' });

		if (result.status !== 'generated') throw new Error('expected a loadout');

		const ak = result.loadout.items.find((item) => item.weapon === 'AK-47');

		expect(ak?.skinName).toBe('Red Dark');
		expect(ak?.match).toBe('color-and-style');
	});

	it('falls back to the colour alone, and says so', async () => {
		// Nothing red-and-dark exists for any slot.
		const result = await generateSmartLoadout({ ...RED_REQUEST, style: 'dark' });

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.items.every((item) => item.match === 'color')).toBe(true);
		expect(result.loadout.partialStyleMatch).toBe(true);
	});

	it('never falls back to a different colour', async () => {
		addSkin('AK-47', 'Blue Thing', 'Rifles', BLUE);

		const result = await generateSmartLoadout({ ...RED_REQUEST, style: 'dark' });

		expect(JSON.stringify(result)).not.toContain('Blue Thing');
	});

	it('requires the style when no colour was asked for', async () => {
		// Only red skins exist, none of them dark, so a dark-only request has
		// nothing to weaken to.
		const result = await generateSmartLoadout({
			budgetMinor: 1_000_000,
			style: 'dark',
			includeKnife: false,
			includeGloves: false
		});

		expect(result).toEqual({ status: 'failed', reason: 'no-visual-candidates' });
	});

	it('generates from a style alone when coverage allows', async () => {
		for (const [weapon, name] of REQUIRED_SLOTS) profiles.set(`${weapon}|${name}`, RED_DARK);

		const result = await generateSmartLoadout({
			budgetMinor: 1_000_000,
			style: 'dark',
			includeKnife: false,
			includeGloves: false
		});

		expect(result.status).toBe('generated');
		expect(
			result.status === 'generated' && result.loadout.items.every((item) => item.match === 'style')
		).toBe(true);
	});
});

describe('alternatives', () => {
	it('uses the real builder slot, never the core entry id', async () => {
		const result = await generateSmartLoadout(RED_REQUEST);

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.selections.map((entry) => entry.slotId)).toContain('m4a1-s');
		expect(result.loadout.selections.map((entry) => entry.slotId)).not.toContain('ct-rifle');
	});

	it('picks one alternative, never both', async () => {
		addSkin('M4A4', 'Red Four', 'Rifles', RED);

		const result = await generateSmartLoadout(RED_REQUEST);

		if (result.status !== 'generated') throw new Error('expected a loadout');

		const rifles = result.loadout.items.filter((item) => item.entryId === 'ct-rifle');

		expect(rifles).toHaveLength(1);
	});

	it('is satisfied by one alternative when the other has nothing curated', async () => {
		// The P2000 has no curated skins at all; the USP-S covers the entry.
		const result = await generateSmartLoadout(RED_REQUEST);

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.items.find((item) => item.entryId === 'ct-pistol')?.weapon).toBe('USP-S');
	});

	it('prefers the alternative that matches best', async () => {
		addSkin('M4A4', 'Red Dark Four', 'Rifles', RED_DARK);

		const result = await generateSmartLoadout({ ...RED_REQUEST, style: 'dark' });

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.items.find((item) => item.entryId === 'ct-rifle')?.weapon).toBe('M4A4');
	});
});

describe('the optional extras', () => {
	it('leaves the knife and gloves out entirely when unchecked', async () => {
		addSkin('Karambit', 'Red Knife', 'Knives', RED);
		addSkin('Sport Gloves', 'Red Gloves', 'Gloves', RED);

		await generateSmartLoadout(RED_REQUEST);

		const itemIds = vi.mocked(market.getManySkinPrices).mock.calls[0][0] as number[];

		// Not generated and discarded — never priced at all.
		expect(itemIds).toHaveLength(6);
	});

	it('includes them when asked', async () => {
		addSkin('Karambit', 'Red Knife', 'Knives', RED);
		addSkin('Sport Gloves', 'Red Gloves', 'Gloves', RED);

		const result = await generateSmartLoadout({
			...RED_REQUEST,
			includeKnife: true,
			includeGloves: true
		});

		if (result.status !== 'generated') throw new Error('expected a loadout');

		expect(result.loadout.items).toHaveLength(8);
		expect(result.loadout.items.map((item) => item.entryId)).toEqual(
			expect.arrayContaining(['knife', 'gloves'])
		);
	});

	it('fails when an enabled extra has no curated match', async () => {
		const result = await generateSmartLoadout({ ...RED_REQUEST, includeKnife: true });

		expect(result).toEqual({ status: 'failed', reason: 'no-visual-candidates' });
	});

	it('counts the extras in the budget minimum', async () => {
		addSkin('Karambit', 'Red Knife', 'Knives', RED);

		const withExtra = await generateSmartLoadout({
			...RED_REQUEST,
			budgetMinor: 100,
			includeKnife: true
		});

		expect(withExtra).toMatchObject({
			status: 'failed',
			reason: 'budget-too-low',
			// Seven entries at 1000 each, knife included.
			minimumMinor: 7000
		});
	});
});

describe('budget', () => {
	it('reports the shortlist minimum when the budget is too low', async () => {
		const result = await generateSmartLoadout({ ...RED_REQUEST, budgetMinor: 100 });

		expect(result).toEqual({
			status: 'failed',
			reason: 'budget-too-low',
			minimumMinor: 6000,
			currency: 'BRL'
		});
	});

	it('succeeds at exactly the minimum', async () => {
		const result = await generateSmartLoadout({ ...RED_REQUEST, budgetMinor: 6000 });

		expect(result.status).toBe('generated');
		expect(result.status === 'generated' && result.loadout.remainingMinor).toBe(0);
	});
});

describe('market failures', () => {
	it('drops a candidate with no current price and uses another', async () => {
		addSkin('AK-47', 'Second Red', 'Rifles', RED);

		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: [],
					// The first AK variant has nothing listed.
					quotes: itemId === 1003 ? [] : [quote('csfloat', 1000, itemId)]
				} as SkinMarketPrices
			}))
		);

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result.status).toBe('generated');
	});

	it('ignores stale and zero quotes', async () => {
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
						quote('csfloat', 1000, itemId)
					]
				} as SkinMarketPrices
			}))
		);

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result.status === 'generated' && result.loadout.totalMinor).toBe(6000);
	});

	it('says an entry has no price rather than blaming the budget', async () => {
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: {
					itemId,
					currency: 'BRL',
					providersQueried: [],
					// Only the AK lost its price.
					quotes: itemId === 1003 ? [] : [quote('csfloat', 1000, itemId)]
				} as SkinMarketPrices
			}))
		);

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result).toEqual({ status: 'failed', reason: 'no-priceable-candidates' });
	});

	it('says the market is unavailable when nothing priced at all', async () => {
		vi.mocked(market.getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({ itemId, state: 'error' as const, prices: null }))
		);

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result).toEqual({ status: 'failed', reason: 'market-unavailable' });
	});

	it('survives the price request throwing', async () => {
		vi.mocked(market.getManySkinPrices).mockRejectedValue(new Error('CS2Cap exploded'));

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result).toEqual({ status: 'failed', reason: 'market-unavailable' });
	});

	it('still prices when the provider directory fails', async () => {
		vi.mocked(market.getMarketProviders).mockRejectedValue(new Error('directory down'));

		const result = await generateSmartLoadout(RED_REQUEST);

		expect(result.status).toBe('generated');
		expect(result.status === 'generated' && result.loadout.items[0].providerName).toBeUndefined();
	});
});

describe('getSmartAvailability', () => {
	it('offers a colour that can fill every required entry', async () => {
		const availability = await getSmartAvailability();

		expect(availability.colors).toContain('red');
	});

	it('withholds a colour that is missing one required entry', async () => {
		// Blue exists for the AK only.
		addSkin('AK-47', 'Blue Thing', 'Rifles', BLUE);

		const availability = await getSmartAvailability();

		expect(availability.colors).not.toContain('blue');
	});

	it('offers a style with full required coverage', async () => {
		for (const [weapon, name] of REQUIRED_SLOTS) profiles.set(`${weapon}|${name}`, RED_DARK);

		const availability = await getSmartAvailability();

		expect(availability.styles).toContain('dark');
	});

	it('judges the optional extras separately, so a colour is not withheld', async () => {
		const availability = await getSmartAvailability();

		// Red works for the required core; there is simply no red knife yet.
		expect(availability.colors).toContain('red');
		expect(availability.colorsWithoutKnife).toContain('red');
		expect(availability.colorsWithoutGloves).toContain('red');
	});

	it('stops reporting an extra as missing once one is curated', async () => {
		addSkin('Karambit', 'Red Knife', 'Knives', RED);

		const availability = await getSmartAvailability();

		expect(availability.colorsWithoutKnife).not.toContain('red');
	});

	it('asks the market for nothing', async () => {
		await getSmartAvailability();

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
	});
});

describe('the priced-candidate cap', () => {
	it('is the shortlist size times the whole core', () => {
		expect(SMART_MAX_PRICED_CANDIDATES).toBe(SMART_CANDIDATES_PER_ENTRY * SMART_CORE.length);
		// Comfortably inside one provider batch request.
		expect(SMART_MAX_PRICED_CANDIDATES).toBeLessThanOrEqual(100);
	});
});
