import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSkinRecommendations } from './recommendations';
import { getAllVisualMetadata, visualMetadataKey } from './visual-metadata';
import type { Skin } from '$lib/types/skin';

// The catalog has its own tests; this is about what reaches a skin page.
vi.mock('./catalog', () => ({ getBrowsableSkins: vi.fn() }));
vi.mock('./market', () => ({
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPrices: vi.fn(),
	getSkinPriceHistory: vi.fn()
}));

const { getBrowsableSkins } = await import('./catalog');
const market = await import('./market');

let nextItemId = 1;

/**
 * A catalog skin, named after a **real curated record** so the production
 * dataset does the classifying. Asserting that two skins look alike is only
 * meaningful against metadata someone actually verified.
 */
function skin(weapon: string, name: string, itemSubtype = 'Rifles'): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		variants: [
			{
				itemId: nextItemId++,
				marketHashName: `${weapon} | ${name} (Factory New)`,
				wear: 'Factory New',
				statTrak: false,
				souvenir: false
			}
		]
	};
}

/** Red, across the slots — every one of these is curated in production. */
const RED_CATALOG: Skin[] = [
	skin('AK-47', 'Redline'),
	skin('AK-47', 'Bloodsport'),
	skin('AK-47', 'Red Laminate'),
	// Curated, same weapon, and shares nothing with a red-and-black AK.
	skin('AK-47', 'Jungle Spray'),
	skin('USP-S', 'Check Engine', 'Pistols'),
	skin('AWP', 'Redline'),
	skin('Desert Eagle', 'Code Red', 'Pistols'),
	skin('Karambit', 'Crimson Web', 'Knives'),
	skin('Sport Gloves', 'Red Racer', 'Gloves'),
	// Deliberately uncurated: a phased finish the dataset excludes on purpose.
	skin('Karambit', 'Doppler', 'Knives')
];

beforeEach(() => {
	nextItemId = 1;
	vi.mocked(getBrowsableSkins).mockReset();
	vi.mocked(market.getSkinPrices).mockReset();
	vi.mocked(market.getManySkinPrices).mockReset();
	vi.mocked(market.getMarketProviders).mockReset();
	vi.mocked(market.getSkinPriceHistory).mockReset();

	vi.mocked(getBrowsableSkins).mockResolvedValue(RED_CATALOG);
});

const source = () => skin('AK-47', 'Redline');

describe('recommending from a curated skin', () => {
	it('returns same-weapon alternatives and cross-slot pairings', async () => {
		const result = await getSkinRecommendations(source());

		expect(result.similar.length).toBeGreaterThan(0);
		expect(result.matches.length).toBeGreaterThan(0);
	});

	it('keeps the source out of its own recommendations', async () => {
		const result = await getSkinRecommendations(source());

		const slugs = [...result.similar, ...result.matches].map((item) => item.slug);

		expect(slugs).not.toContain('ak-47-redline');
	});

	it('keeps Similar to the same weapon', async () => {
		const { similar } = await getSkinRecommendations(source());

		expect(similar.every((item) => item.skin.weapon === 'AK-47')).toBe(true);
	});

	it('keeps Matches off the source weapon', async () => {
		const { matches } = await getSkinRecommendations(source());

		expect(matches.some((item) => item.skin.weapon === 'AK-47')).toBe(false);
	});

	it('reaches the knife and the gloves, through slot identity', async () => {
		const { matches } = await getSkinRecommendations(source());

		expect(matches.map((item) => item.slotId)).toEqual(expect.arrayContaining(['knife', 'gloves']));
	});

	it('leaves an uncurated candidate out even in a matching slot', async () => {
		const { matches } = await getSkinRecommendations(source());

		// The Karambit that gets recommended is the curated one.
		expect(matches.map((item) => item.slug)).not.toContain('karambit-doppler');
	});

	it('never recommends something with no verified overlap', async () => {
		const result = await getSkinRecommendations(source());

		const slugs = [...result.similar, ...result.matches].map((item) => item.slug);

		// Jungle Spray is a curated AK-47: green and military, against a red,
		// black and dark source. Nothing in common means not recommended.
		expect(slugs).not.toContain('ak-47-jungle-spray');
	});

	it('is deterministic', async () => {
		const first = await getSkinRecommendations(source());
		const second = await getSkinRecommendations(source());

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it('is unaffected by the order the catalog arrives in', async () => {
		const forwards = await getSkinRecommendations(source());

		vi.mocked(getBrowsableSkins).mockResolvedValue([...RED_CATALOG].reverse());
		const backwards = await getSkinRecommendations(source());

		expect(backwards.similar.map((item) => item.slug)).toEqual(
			forwards.similar.map((item) => item.slug)
		);
		expect(backwards.matches.map((item) => item.slug)).toEqual(
			forwards.matches.map((item) => item.slug)
		);
	});
});

describe('recommending from an uncurated skin', () => {
	// A real catalog skin that nobody has classified.
	const uncurated = () => skin('Nova', 'Bloomstick', 'Heavy');

	it('returns nothing rather than inventing a basis for a recommendation', async () => {
		expect(await getSkinRecommendations(uncurated())).toEqual({ similar: [], matches: [] });
	});

	it('does not even read the catalog', async () => {
		await getSkinRecommendations(uncurated());

		expect(getBrowsableSkins).not.toHaveBeenCalled();
	});
});

describe('what it costs', () => {
	it('asks the market for nothing at all', async () => {
		await getSkinRecommendations(source());

		expect(market.getSkinPrices).not.toHaveBeenCalled();
		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
		expect(market.getSkinPriceHistory).not.toHaveBeenCalled();
	});

	it('reads the catalog once, however many sections it fills', async () => {
		await getSkinRecommendations(source());

		expect(getBrowsableSkins).toHaveBeenCalledTimes(1);
	});

	it('imports no market service — the guarantee, not just the behaviour', () => {
		// A future edit that adds pricing would pass every test above by
		// mocking it. This one fails.
		const source = readFileSync('src/lib/server/services/recommendations.ts', 'utf8');

		expect(source).not.toMatch(/from '\.\/market'/);
		expect(source).not.toMatch(/getSkinPrices|getManySkinPrices|getMarketProviders/);
	});
});

describe('against the production dataset', () => {
	it('classifies the identities these tests lean on', () => {
		// If curation moves, the assertions above should fail loudly here
		// rather than quietly stop testing anything.
		const keys = new Set(getAllVisualMetadata().map((record) => record.key));

		// Built with the canonical helper, never hand-written.
		for (const [weapon, name] of [
			['AK-47', 'Redline'],
			['AK-47', 'Bloodsport'],
			['AK-47', 'Jungle Spray'],
			['AWP', 'Redline'],
			['Desert Eagle', 'Code Red'],
			['Karambit', 'Crimson Web'],
			['Sport Gloves', 'Red Racer']
		]) {
			expect(keys.has(visualMetadataKey(weapon, name)), `${weapon} | ${name}`).toBe(true);
		}

		// And the phased finish stays out, as `docs/VISUAL_METADATA.md` says.
		expect(keys.has(visualMetadataKey('Karambit', 'Doppler'))).toBe(false);
	});

	it('finds red company for a red AK from real curation', async () => {
		const { similar, matches } = await getSkinRecommendations(source());

		// Every recommendation shares verified red with AK-47 | Redline.
		for (const item of [...similar, ...matches]) {
			expect(item.matchedColors.length + item.matchedStyles.length, item.slug).toBeGreaterThan(0);
			expect(item.similarityScore, item.slug).toBeGreaterThan(0);
		}
	});
});
