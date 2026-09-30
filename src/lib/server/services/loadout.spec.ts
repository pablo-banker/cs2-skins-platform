import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LoadoutSelectionError,
	priceLoadout,
	resolveSelections,
	resolveSelectionsTolerantly,
	searchSlotSkins
} from './loadout';
import { STEAM_PROVIDER_ID } from '$lib/features/prices/steam';
import type { LoadoutSelection } from '$lib/types/loadout';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';

// The catalog and market layers have their own tests; this is about
// orchestration — resolve, validate, price, aggregate.
vi.mock('./catalog', () => ({ getBrowsableSkins: vi.fn(), getSkinBySlug: vi.fn() }));
vi.mock('./market', () => ({ getManySkinPrices: vi.fn(), getMarketProviders: vi.fn() }));

const { getBrowsableSkins, getSkinBySlug } = await import('./catalog');
const { getManySkinPrices, getMarketProviders } = await import('./market');

function variant(itemId: number, overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId,
		marketHashName: `item-${itemId}`,
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

function skin(
	slug: string,
	weapon: string,
	itemSubtype: string,
	variants: SkinVariant[] = [variant(1)]
): Skin {
	return {
		id: slug,
		weapon,
		name: 'Finish',
		fullName: `${weapon} | Finish`,
		itemSubtype,
		variants
	};
}

const CATALOG: Record<string, Skin> = {
	'ak-47-redline': skin('ak-47-redline', 'AK-47', 'Rifles', [
		variant(101, { wear: 'Field-Tested' }),
		variant(102, { wear: 'Minimal Wear' }),
		variant(103, { wear: 'Field-Tested', statTrak: true })
	]),
	'awp-asiimov': skin('awp-asiimov', 'AWP', 'Rifles', [variant(201, { wear: 'Field-Tested' })]),
	'karambit-doppler': skin('karambit-doppler', 'Karambit', 'Knives', [
		variant(301, { wear: 'Factory New', phase: 'Phase 2' }),
		variant(302, { wear: 'Factory New', phase: 'Phase 4' })
	]),
	'sport-gloves-vice': skin('sport-gloves-vice', 'Sport Gloves', 'Gloves', [
		variant(401, { wear: 'Field-Tested' })
	]),
	bayonet: skin('bayonet', 'Bayonet', 'Knives', [variant(501, { wear: 'Not Painted' })])
};

function quote(providerId: string, priceMinor: number, itemId: number): MarketQuote {
	return {
		providerId,
		itemId,
		priceMinor,
		currency: 'BRL',
		quantity: 3,
		stale: false
	};
}

function prices(itemId: number, offers: [string, number][]): SkinMarketPrices {
	const quotes = offers
		.map(([providerId, priceMinor]) => quote(providerId, priceMinor, itemId))
		.sort((a, b) => a.priceMinor - b.priceMinor);

	return { itemId, currency: 'BRL', providersQueried: ['x'], quotes, bestQuote: quotes[0] };
}

/** Prices every requested id at the same offers, unless overridden. */
function pricedAll(offers: (itemId: number) => [string, number][]) {
	vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
		[...itemIds].map((itemId) => ({
			itemId,
			state: 'loaded' as const,
			prices: prices(itemId, offers(itemId))
		}))
	);
}

beforeEach(() => {
	vi.mocked(getBrowsableSkins).mockReset();
	vi.mocked(getSkinBySlug).mockReset();
	vi.mocked(getManySkinPrices).mockReset();
	vi.mocked(getMarketProviders).mockReset();

	vi.mocked(getSkinBySlug).mockImplementation(async (slug: string) => CATALOG[slug]);
	vi.mocked(getMarketProviders).mockResolvedValue([
		{ id: 'csfloat', name: 'CSFloat', status: 'up' },
		{ id: STEAM_PROVIDER_ID, name: 'Steam', status: 'up' }
	]);
});

describe('searchSlotSkins', () => {
	it('answers for a known slot without asking the market anything', async () => {
		vi.mocked(getBrowsableSkins).mockResolvedValue([CATALOG['ak-47-redline']]);

		const page = await searchSlotSkins('ak-47', { page: 1 });

		expect(page?.options).toHaveLength(1);
		expect(getManySkinPrices).not.toHaveBeenCalled();
		expect(getMarketProviders).not.toHaveBeenCalled();
	});

	it('returns nothing for a slot the registry does not have', async () => {
		await expect(searchSlotSkins('rocket-launcher', { page: 1 })).resolves.toBeUndefined();
		expect(getBrowsableSkins).not.toHaveBeenCalled();
	});
});

describe('resolveSelections', () => {
	function selection(overrides: Partial<LoadoutSelection> = {}): LoadoutSelection {
		return {
			slotId: 'ak-47',
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Field-Tested' },
			...overrides
		};
	}

	it('resolves a firearm selection to its exact variant', async () => {
		const [resolved] = await resolveSelections([selection()]);

		expect(resolved.variant.itemId).toBe(101);
		expect(resolved.slot.id).toBe('ak-47');
	});

	it('resolves an exact edition', async () => {
		const [resolved] = await resolveSelections([
			selection({ variant: { wear: 'Field-Tested', edition: 'stattrak' } })
		]);

		expect(resolved.variant.itemId).toBe(103);
		expect(resolved.variant.statTrak).toBe(true);
	});

	it('resolves an exact phase', async () => {
		const [resolved] = await resolveSelections([
			selection({
				slotId: 'knife',
				skinSlug: 'karambit-doppler',
				variant: { wear: 'Factory New', phase: 'Phase 4' }
			})
		]);

		expect(resolved.variant.itemId).toBe(302);
	});

	it('resolves a knife and gloves through their subtype slots', async () => {
		const resolved = await resolveSelections([
			selection({ slotId: 'knife', skinSlug: 'karambit-doppler', variant: {} }),
			selection({ slotId: 'gloves', skinSlug: 'sport-gloves-vice', variant: {} })
		]);

		expect(resolved.map((entry) => entry.slot.id)).toEqual(['knife', 'gloves']);
	});

	it('resolves a vanilla knife, which has no finish', async () => {
		const [resolved] = await resolveSelections([
			selection({ slotId: 'knife', skinSlug: 'bayonet', variant: {} })
		]);

		expect(resolved.variant.itemId).toBe(501);
	});

	it('rejects a skin that does not belong in the slot', async () => {
		// The client is not the authority on what an AK-47 finish is.
		await expect(resolveSelections([selection({ slotId: 'gloves' })])).rejects.toBeInstanceOf(
			LoadoutSelectionError
		);
	});

	it('rejects a knife in a firearm slot and a rifle in the knife slot', async () => {
		await expect(resolveSelections([selection({ skinSlug: 'karambit-doppler' })])).rejects.toThrow(
			LoadoutSelectionError
		);

		await expect(resolveSelections([selection({ slotId: 'knife' })])).rejects.toThrow(
			LoadoutSelectionError
		);
	});

	it('rejects an unknown slot', async () => {
		await expect(resolveSelections([selection({ slotId: 'rocket-launcher' })])).rejects.toThrow(
			'unknown-slot'
		);
	});

	it('rejects an unknown skin slug', async () => {
		await expect(resolveSelections([selection({ skinSlug: 'not-a-real-skin' })])).rejects.toThrow(
			'unknown-skin'
		);
	});

	it('rejects a duplicate slot rather than silently keeping one', async () => {
		await expect(
			resolveSelections([selection(), selection({ skinSlug: 'ak-47-redline' })])
		).rejects.toThrow('duplicate-slot');
	});

	it('rejects an exterior the skin does not have', async () => {
		// A builder selection is an exact choice; substituting would price a
		// different item than the visitor picked.
		await expect(
			resolveSelections([selection({ variant: { wear: 'Factory New' } })])
		).rejects.toThrow('invalid-variant for slot "ak-47"');
	});

	it('rejects a phase the skin does not have', async () => {
		await expect(
			resolveSelections([
				selection({ slotId: 'knife', skinSlug: 'karambit-doppler', variant: { phase: 'Ruby' } })
			])
		).rejects.toThrow('invalid-variant for slot "knife"');
	});

	it('does not mutate the selections it was given', async () => {
		const selections = [selection()];
		const snapshot = structuredClone(selections);

		await resolveSelections(selections);

		expect(selections).toEqual(snapshot);
	});
});

describe('priceLoadout', () => {
	const LOADOUT: LoadoutSelection[] = [
		{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
		{ slotId: 'awp', skinSlug: 'awp-asiimov', variant: { wear: 'Field-Tested' } }
	];

	it('prices the exact variants, in one multi-item request', async () => {
		pricedAll(() => [['csfloat', 10000]]);

		await priceLoadout(LOADOUT);

		expect(getManySkinPrices).toHaveBeenCalledTimes(1);
		expect(vi.mocked(getManySkinPrices).mock.calls[0][0]).toEqual([101, 201]);
	});

	it('reports the cheapest offer and its marketplace per item', async () => {
		pricedAll((itemId) => [
			['csfloat', itemId === 101 ? 12000 : 50000],
			[STEAM_PROVIDER_ID, itemId === 101 ? 15000 : 60000]
		]);

		const result = await priceLoadout(LOADOUT);

		expect(result.items[0]).toMatchObject({
			slotId: 'ak-47',
			skinSlug: 'ak-47-redline',
			state: 'priced',
			bestPriceMinor: 12000,
			providerId: 'csfloat',
			providerName: 'CSFloat'
		});
	});

	it('totals the selected items in integer minor units', async () => {
		pricedAll((itemId) => [['csfloat', itemId === 101 ? 12000 : 50000]]);

		const result = await priceLoadout(LOADOUT);

		expect(result.complete).toBe(true);
		expect(result.total).toEqual({ priceMinor: 62000, currency: 'BRL' });
	});

	it('compares against Steam when Steam quotes every selected item', async () => {
		pricedAll((itemId) => [
			['csfloat', itemId === 101 ? 12000 : 50000],
			[STEAM_PROVIDER_ID, itemId === 101 ? 15000 : 60000]
		]);

		const result = await priceLoadout(LOADOUT);

		expect(result.steam).toEqual({ totalMinor: 75000, currency: 'BRL', savingsMinor: 13000 });
	});

	it('omits the Steam comparison when Steam is missing one item', async () => {
		pricedAll((itemId) =>
			itemId === 101
				? [
						['csfloat', 12000],
						[STEAM_PROVIDER_ID, 15000]
					]
				: [['csfloat', 50000]]
		);

		const result = await priceLoadout(LOADOUT);

		// A Steam total missing a skin is not a Steam total.
		expect(result.steam).toBeUndefined();
		expect(result.total).toBeDefined();
	});

	it('withholds the total when one selected item has no quotes', async () => {
		vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => ({
				itemId,
				state: 'loaded' as const,
				prices: prices(itemId, itemId === 101 ? [['csfloat', 12000]] : [])
			}))
		);

		const result = await priceLoadout(LOADOUT);

		expect(result.complete).toBe(false);
		expect(result.total).toBeUndefined();
		expect(result.items[1].state).toBe('no-quotes');
		// The item that did price still shows its price.
		expect(result.items[0].bestPriceMinor).toBe(12000);
	});

	it('withholds the total when one item failed to load', async () => {
		vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) =>
				itemId === 201
					? { itemId, state: 'error' as const, prices: null }
					: { itemId, state: 'loaded' as const, prices: prices(itemId, [['csfloat', 12000]]) }
			)
		);

		const result = await priceLoadout(LOADOUT);

		expect(result.complete).toBe(false);
		expect(result.total).toBeUndefined();
		expect(result.items[1].state).toBe('error');
	});

	it('keeps "nothing listed" and "could not ask" apart', async () => {
		vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) =>
				itemId === 201
					? { itemId, state: 'error' as const, prices: null }
					: { itemId, state: 'loaded' as const, prices: prices(itemId, []) }
			)
		);

		const result = await priceLoadout(LOADOUT);

		expect(result.items.map((item) => item.state)).toEqual(['no-quotes', 'error']);
	});

	it('ignores stale and zero quotes when picking a best price', async () => {
		vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => {
				const set = prices(itemId, [['csfloat', 12000]]);
				set.quotes.unshift({ ...quote('ghost', 1, itemId), stale: true });
				set.quotes.unshift(quote('broken', 0, itemId));

				return { itemId, state: 'loaded' as const, prices: set };
			})
		);

		const result = await priceLoadout(LOADOUT);

		expect(result.items.every((item) => item.bestPriceMinor === 12000)).toBe(true);
		expect(result.total?.priceMinor).toBe(24000);
	});

	it('still prices when the provider directory fails, falling back to the key', async () => {
		vi.mocked(getMarketProviders).mockRejectedValue(new Error('directory down'));
		pricedAll(() => [['csfloat', 12000]]);

		const result = await priceLoadout(LOADOUT);

		expect(result.total?.priceMinor).toBe(24000);
		expect(result.items[0].providerName).toBe('csfloat');
	});

	it('refuses a total across currencies rather than converting', async () => {
		vi.mocked(getManySkinPrices).mockImplementation(async (itemIds) =>
			[...itemIds].map((itemId) => {
				const set = prices(itemId, [['csfloat', 12000]]);
				if (itemId === 201) set.quotes[0].currency = 'USD';

				return { itemId, state: 'loaded' as const, prices: set };
			})
		);

		const result = await priceLoadout(LOADOUT);

		expect(result.total).toBeUndefined();
		expect(result.complete).toBe(false);
	});

	it('echoes the fingerprint of what it priced', async () => {
		pricedAll(() => [['csfloat', 12000]]);

		const result = await priceLoadout(LOADOUT);

		expect(result.fingerprint).toBe(
			'ak-47:ak-47-redline:Field-Tested::|awp:awp-asiimov:Field-Tested::'
		);
	});

	it('generates no purchase strategy — that is not what a builder shows', async () => {
		pricedAll(() => [['csfloat', 12000]]);

		const result = await priceLoadout(LOADOUT);

		expect(result).not.toHaveProperty('groups');
		expect(result).not.toHaveProperty('providerCount');
		expect(JSON.stringify(result)).not.toMatch(/fewer|marketplaces|subtotal/i);
	});

	it('asks for no price history', async () => {
		pricedAll(() => [['csfloat', 12000]]);

		const result = await priceLoadout(LOADOUT);

		expect(JSON.stringify(result)).not.toMatch(/history|candle/i);
	});

	it('rejects before spending a request when a selection is invalid', async () => {
		await expect(
			priceLoadout([{ slotId: 'gloves', skinSlug: 'ak-47-redline', variant: {} }])
		).rejects.toBeInstanceOf(LoadoutSelectionError);

		expect(getManySkinPrices).not.toHaveBeenCalled();
	});
});

/**
 * Restoring is tolerant where pricing is strict.
 *
 * Both go through the same `resolveOne`, so they can never disagree about what
 * is valid — they differ only in what they do about an invalid selection.
 */
describe('resolveSelectionsTolerantly', () => {
	it('resolves everything valid, with current catalog data attached', async () => {
		const { selections, rejected } = await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
			{ slotId: 'knife', skinSlug: 'karambit-doppler', variant: {} }
		]);

		expect(rejected).toEqual([]);
		expect(selections.map((entry) => entry.slotId)).toEqual(['ak-47', 'knife']);
		// Enough to render a filled slot without shipping the catalog.
		expect(selections[0].option.slug).toBe('ak-47-redline');
		expect(selections[0].option.variants.length).toBeGreaterThan(0);
	});

	it('echoes the exact variant it resolved', async () => {
		const [resolved] = (
			await resolveSelectionsTolerantly([
				{
					slotId: 'ak-47',
					skinSlug: 'ak-47-redline',
					variant: { wear: 'Field-Tested', edition: 'stattrak' }
				}
			])
		).selections;

		expect(resolved.variant).toEqual({
			wear: 'Field-Tested',
			edition: 'stattrak',
			phase: undefined
		});
	});

	it('keeps the valid selections and reports the rest', async () => {
		// A loadout that lost one skin to a game update comes back missing one
		// skin, not missing everything.
		const { selections, rejected } = await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
			{ slotId: 'awp', skinSlug: 'not-a-real-skin', variant: {} },
			{ slotId: 'knife', skinSlug: 'karambit-doppler', variant: {} }
		]);

		expect(selections.map((entry) => entry.slotId)).toEqual(['ak-47', 'knife']);
		expect(rejected).toEqual([{ slotId: 'awp', reason: 'unknown-skin' }]);
	});

	it('names a reason for each kind of failure', async () => {
		const { rejected } = await resolveSelectionsTolerantly([
			{ slotId: 'rocket-launcher', skinSlug: 'ak-47-redline', variant: {} },
			{ slotId: 'awp', skinSlug: 'not-a-real-skin', variant: {} },
			{ slotId: 'gloves', skinSlug: 'ak-47-redline', variant: {} },
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Factory New' } }
		]);

		expect(rejected).toEqual([
			{ reason: 'unknown-slot' },
			{ slotId: 'awp', reason: 'unknown-skin' },
			{ slotId: 'gloves', reason: 'incompatible' },
			{ slotId: 'ak-47', reason: 'invalid-variant' }
		]);
	});

	it('rejects a repeated slot rather than letting the later one win', async () => {
		const { selections, rejected } = await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Minimal Wear' } }
		]);

		expect(selections).toHaveLength(1);
		expect(selections[0].variant.wear).toBe('Field-Tested');
		expect(rejected).toEqual([{ slotId: 'ak-47', reason: 'duplicate-slot' }]);
	});

	it('never substitutes a close-enough variant', async () => {
		// The exact-selection promise holds for a loadout restored a year later.
		const { selections, rejected } = await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Factory New' } }
		]);

		expect(selections).toEqual([]);
		expect(rejected[0].reason).toBe('invalid-variant');
	});

	it('handles an empty list without complaint', async () => {
		await expect(resolveSelectionsTolerantly([])).resolves.toEqual({
			selections: [],
			rejected: []
		});
	});

	it('asks the market for nothing at all', async () => {
		await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }
		]);

		expect(getManySkinPrices).not.toHaveBeenCalled();
		expect(getMarketProviders).not.toHaveBeenCalled();
	});

	it('returns nothing a market response could have produced', async () => {
		const { selections } = await resolveSelectionsTolerantly([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }
		]);

		expect(JSON.stringify(selections)).not.toMatch(/price|currency|provider|steam|quote/i);
	});

	it('does not mutate the selections it was given', async () => {
		const selections = [
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }
		];
		const snapshot = structuredClone(selections);

		await resolveSelectionsTolerantly(selections);

		expect(selections).toEqual(snapshot);
	});

	it('agrees with the strict resolver about what is valid', async () => {
		const valid = [
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
			{ slotId: 'knife', skinSlug: 'karambit-doppler', variant: {} }
		];

		const strict = await resolveSelections(valid);
		const tolerant = await resolveSelectionsTolerantly(valid);

		expect(tolerant.rejected).toEqual([]);
		expect(tolerant.selections.map((entry) => entry.slotId)).toEqual(
			strict.map((entry) => entry.slot.id)
		);
	});
});
