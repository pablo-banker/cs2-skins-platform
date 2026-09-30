import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countCuratedCandidates, getCuratedCandidates } from './smart-candidates';
import type { Skin } from '$lib/types/skin';
import type { SkinVisualProfile } from '$lib/types/visual-metadata';

// The catalog and the curated dataset both have their own tests; this is about
// what the candidate pool lets through.
vi.mock('./catalog', () => ({ getBrowsableSkins: vi.fn() }));
vi.mock('./visual-metadata', async (importOriginal) => ({
	...(await importOriginal<typeof import('./visual-metadata')>()),
	getVisualProfile: vi.fn()
}));
vi.mock('./market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPrices: vi.fn()
}));

const { getBrowsableSkins } = await import('./catalog');
const { getVisualProfile } = await import('./visual-metadata');
const market = await import('./market');

function skin(weapon: string, name: string, itemSubtype = 'Rifles'): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		variants: []
	};
}

const CATALOG: Skin[] = [
	skin('AK-47', 'Redline'),
	skin('AK-47', 'Slate'),
	skin('AK-47', 'Vulcan'),
	skin('AK-47', 'Asiimov'),
	skin('AWP', 'Asiimov'),
	skin('Karambit', 'Night', 'Knives'),
	skin('Sport Gloves', 'Vice', 'Gloves')
];

/** Only these skins have been looked at; everything else is uncurated. */
const PROFILES: Record<string, SkinVisualProfile> = {
	'AK-47|Redline': { primaryColors: ['red', 'black'], secondaryColors: [], styles: ['dark'] },
	'AK-47|Slate': { primaryColors: ['gray', 'black'], secondaryColors: [], styles: ['minimal'] },
	'AK-47|Asiimov': {
		primaryColors: ['white', 'orange'],
		secondaryColors: ['black'],
		styles: ['futuristic']
	},
	'AWP|Asiimov': { primaryColors: ['white', 'orange'], secondaryColors: [], styles: [] },
	'Karambit|Night': { primaryColors: ['black'], secondaryColors: [], styles: ['dark'] },
	'Sport Gloves|Vice': { primaryColors: ['pink', 'cyan'], secondaryColors: [], styles: ['neon'] }
};

beforeEach(() => {
	vi.mocked(getBrowsableSkins).mockReset();
	vi.mocked(getVisualProfile).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();

	vi.mocked(getBrowsableSkins).mockResolvedValue(CATALOG);
	vi.mocked(getVisualProfile).mockImplementation(
		(weapon: string, name: string) => PROFILES[`${weapon}|${name}`] ?? null
	);
});

describe('slot compatibility', () => {
	it('returns only skins the slot accepts', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47' });

		expect(candidates.every((skin) => skin.weapon === 'AK-47')).toBe(true);
	});

	it('finds knives and gloves through their subtype slots', async () => {
		expect((await getCuratedCandidates({ slotId: 'knife' }))[0]?.weapon).toBe('Karambit');
		expect((await getCuratedCandidates({ slotId: 'gloves' }))[0]?.weapon).toBe('Sport Gloves');
	});

	it('returns nothing for a slot the registry does not have', async () => {
		await expect(getCuratedCandidates({ slotId: 'rocket-launcher' })).resolves.toEqual([]);
		expect(getBrowsableSkins).not.toHaveBeenCalled();
	});
});

describe('curation is the price of entry', () => {
	it('excludes skins nobody has looked at', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47' });

		// Vulcan is in the catalog and uncurated.
		expect(candidates.map((skin) => skin.name)).not.toContain('Vulcan');
		expect(candidates).toHaveLength(3);
	});

	it('gives every candidate a visual profile to match on', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47' });

		expect(candidates.every((skin) => skin.visual !== null)).toBe(true);
	});

	it('returns nothing when the whole slot is uncurated', async () => {
		vi.mocked(getVisualProfile).mockReturnValue(null);

		await expect(getCuratedCandidates({ slotId: 'ak-47' })).resolves.toEqual([]);
	});
});

describe('visual criteria', () => {
	it('filters by colour', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47', colors: ['red'] });

		expect(candidates.map((skin) => skin.name)).toEqual(['Redline']);
	});

	it('honours the primary-only scope', async () => {
		// Asiimov has black as a secondary colour only.
		const any = await getCuratedCandidates({ slotId: 'ak-47', colors: ['black'] });
		const primary = await getCuratedCandidates({
			slotId: 'ak-47',
			colors: ['black'],
			colorScope: 'primary'
		});

		expect(any.map((skin) => skin.name).sort()).toEqual(['Asiimov', 'Redline', 'Slate']);
		expect(primary.map((skin) => skin.name).sort()).toEqual(['Redline', 'Slate']);
	});

	it('filters by style', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47', styles: ['dark'] });

		expect(candidates.map((skin) => skin.name)).toEqual(['Redline']);
	});

	it('combines colour and style', async () => {
		const candidates = await getCuratedCandidates({
			slotId: 'ak-47',
			colors: ['black'],
			styles: ['minimal']
		});

		expect(candidates.map((skin) => skin.name)).toEqual(['Slate']);
	});

	it('demands every colour in "all" mode', async () => {
		const candidates = await getCuratedCandidates({
			slotId: 'ak-47',
			colors: ['red', 'black'],
			colorMode: 'all'
		});

		expect(candidates.map((skin) => skin.name)).toEqual(['Redline']);
	});

	it('returns the whole curated slot when no criteria are given', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47' });

		expect(candidates).toHaveLength(3);
	});
});

describe('ranking and limits', () => {
	it('puts the best visual match first', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47', colors: ['black'] });

		// Redline and Slate carry black as primary; Asiimov only as secondary.
		expect(candidates.at(-1)?.name).toBe('Asiimov');
	});

	it('is deterministic for the same query', async () => {
		const first = await getCuratedCandidates({ slotId: 'ak-47', colors: ['black'] });
		const second = await getCuratedCandidates({ slotId: 'ak-47', colors: ['black'] });

		expect(second.map((skin) => skin.name)).toEqual(first.map((skin) => skin.name));
	});

	it('applies a limit after ranking', async () => {
		const candidates = await getCuratedCandidates({
			slotId: 'ak-47',
			colors: ['black'],
			limit: 1
		});

		expect(candidates).toHaveLength(1);
		expect(candidates[0].visual?.primaryColors).toContain('black');
	});

	it('counts candidates without returning them', async () => {
		await expect(countCuratedCandidates('ak-47')).resolves.toBe(3);
		await expect(countCuratedCandidates('awp')).resolves.toBe(1);
	});
});

describe('boundaries', () => {
	it('asks the market for nothing', async () => {
		await getCuratedCandidates({ slotId: 'ak-47', colors: ['red'] });

		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
		expect(market.getSkinPrices).not.toHaveBeenCalled();
	});

	it('returns no price of any kind', async () => {
		const candidates = await getCuratedCandidates({ slotId: 'ak-47' });

		expect(JSON.stringify(candidates)).not.toMatch(/price|currency|provider|quote/i);
	});

	it('does not mutate the catalog it read', async () => {
		const snapshot = structuredClone(CATALOG);

		await getCuratedCandidates({ slotId: 'ak-47', colors: ['red'] });

		expect(CATALOG).toEqual(snapshot);
	});
});
