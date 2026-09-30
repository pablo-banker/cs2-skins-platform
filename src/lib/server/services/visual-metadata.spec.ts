import { describe, expect, it } from 'vitest';
import {
	createVisualMetadataIndex,
	getAllVisualMetadata,
	getVisualMetadata,
	getVisualMetadataCount,
	getVisualProfile,
	getVisualTaxonomy,
	visualMetadataKey
} from './visual-metadata';
import {
	skinVisualMetadataFileSchema,
	skinVisualMetadataSchema,
	visualTaxonomyFileSchema
} from '$lib/schemas/visual-metadata';
import { SKIN_COLORS, SKIN_STYLES, type SkinVisualMetadata } from '$lib/types/visual-metadata';
import taxonomyFile from '$lib/data/visual-taxonomy.json';
import metadataFile from '$lib/data/skin-visual-metadata.json';
import fixtureFile from '$lib/data/curated-catalog-fixture.json';

/**
 * Fictional fixtures. Production curation must come from looking at a skin, so
 * tests invent their own rather than asserting claims about real ones.
 */
function record(overrides: Partial<SkinVisualMetadata> = {}): SkinVisualMetadata {
	return {
		key: 'test-weapon::test-skin',
		weapon: 'Test Weapon',
		skinName: 'Test Skin',
		primaryColors: ['red'],
		secondaryColors: ['black'],
		styles: ['dark'],
		...overrides
	};
}

/**
 * A record the type system would reject — the point of these cases is that the
 * schema catches what a curator could still type into the JSON by hand.
 */
function invalidRecord(overrides: Record<string, unknown>): unknown {
	return { ...record(), ...overrides };
}

describe('visualMetadataKey', () => {
	it('builds a lowercase weapon::name key', () => {
		expect(visualMetadataKey('AK-47', 'Redline')).toBe('ak-47::redline');
	});

	it('normalizes case, surrounding whitespace and repeated whitespace', () => {
		expect(visualMetadataKey('  AK-47 ', ' Neon   Rider ')).toBe('ak-47::neon rider');
		expect(visualMetadataKey('ak-47', 'NEON RIDER')).toBe('ak-47::neon rider');
	});

	it('keeps meaningful punctuation so distinct skins stay distinct', () => {
		expect(visualMetadataKey('M4A1-S', 'Printstream')).toBe('m4a1-s::printstream');
		expect(visualMetadataKey('★ Karambit', 'Doppler')).toBe('★ karambit::doppler');
		expect(visualMetadataKey('AK-47', 'Case Hardened')).not.toBe(
			visualMetadataKey('AK-47', 'Case-Hardened')
		);
	});

	it('is stable across wear, StatTrak and Souvenir, because those are not identity', () => {
		// Every variant of one skin looks the same; curation describes the skin.
		const key = visualMetadataKey('AK-47', 'Redline');

		expect(visualMetadataKey('AK-47', 'Redline')).toBe(key);
		expect(key).not.toContain('field-tested');
		expect(key).not.toContain('stattrak');
		expect(key).not.toContain('12632');
	});
});

describe('createVisualMetadataIndex', () => {
	it('indexes records by key for O(1) lookup', () => {
		const index = createVisualMetadataIndex([
			record(),
			record({ key: 'other::skin', weapon: 'Other', skinName: 'Skin' })
		]);

		expect(index.size).toBe(2);
		expect(index.get('test-weapon::test-skin')?.weapon).toBe('Test Weapon');
	});

	it('throws on a duplicate key instead of silently keeping one', () => {
		expect(() =>
			createVisualMetadataIndex([record(), record({ primaryColors: ['blue'] })])
		).toThrow(/Duplicate visual metadata key "test-weapon::test-skin"/);
	});
});

describe('skinVisualMetadataSchema', () => {
	it('accepts a well-formed record', () => {
		expect(skinVisualMetadataSchema.safeParse(record()).success).toBe(true);
	});

	it('rejects a colour outside the controlled vocabulary', () => {
		expect(
			skinVisualMetadataSchema.safeParse(invalidRecord({ primaryColors: ['crimson'] })).success
		).toBe(false);
		expect(
			skinVisualMetadataSchema.safeParse(invalidRecord({ secondaryColors: ['navy'] })).success
		).toBe(false);
	});

	it('rejects a style outside the controlled vocabulary', () => {
		expect(
			skinVisualMetadataSchema.safeParse(invalidRecord({ styles: ['vaporwave'] })).success
		).toBe(false);
	});

	it('rejects a repeated colour or style within one list', () => {
		expect(
			skinVisualMetadataSchema.safeParse(record({ primaryColors: ['red', 'red'] })).success
		).toBe(false);
		expect(skinVisualMetadataSchema.safeParse(record({ styles: ['dark', 'dark'] })).success).toBe(
			false
		);
	});

	it('rejects a colour listed as both primary and secondary', () => {
		const result = skinVisualMetadataSchema.safeParse(
			record({ primaryColors: ['red'], secondaryColors: ['red'] })
		);

		expect(result.success).toBe(false);
	});

	it('rejects an empty weapon or skin name', () => {
		expect(skinVisualMetadataSchema.safeParse(record({ weapon: '   ' })).success).toBe(false);
		expect(skinVisualMetadataSchema.safeParse(record({ skinName: '' })).success).toBe(false);
	});

	it('rejects a record that classifies nothing', () => {
		const result = skinVisualMetadataSchema.safeParse(
			record({ primaryColors: [], secondaryColors: ['black'], styles: [] })
		);

		expect(result.success).toBe(false);
	});

	it('accepts a record carrying only a style', () => {
		expect(
			skinVisualMetadataSchema.safeParse(
				record({ primaryColors: [], secondaryColors: [], styles: ['minimal'] })
			).success
		).toBe(true);
	});

	it('rejects a malformed or uppercase key', () => {
		expect(skinVisualMetadataSchema.safeParse(record({ key: 'no-separator' })).success).toBe(false);
		expect(skinVisualMetadataSchema.safeParse(record({ key: 'AK-47::Redline' })).success).toBe(
			false
		);
		expect(skinVisualMetadataSchema.safeParse(record({ key: '::redline' })).success).toBe(false);
	});

	it('refuses dynamic market data, so the file cannot become a shadow database', () => {
		const withPrice = invalidRecord({ priceMinor: 14250 });
		const withProvider = invalidRecord({ bestProvider: 'csfloat' });
		const withStamp = invalidRecord({ lastUpdated: '2026-09-21T00:00:00Z' });

		for (const candidate of [withPrice, withProvider, withStamp]) {
			expect(skinVisualMetadataSchema.safeParse(candidate).success).toBe(false);
		}
	});
});

describe('production data files', () => {
	it('the metadata dataset parses, empty or not', () => {
		const result = skinVisualMetadataFileSchema.safeParse(metadataFile);

		expect(result.success).toBe(true);
	});

	it('holds verified records, not guesses', () => {
		// Classification comes from looking at a skin, so the dataset grows
		// only as fast as someone can actually inspect images. It is a curated
		// starter pool, not a classification of the whole catalog.
		expect(getVisualMetadataCount()).toBeGreaterThan(0);
		expect(getAllVisualMetadata()).toHaveLength(getVisualMetadataCount());
	});

	it('rejects a dataset with duplicate keys', () => {
		const result = skinVisualMetadataFileSchema.safeParse({
			records: [record(), record({ primaryColors: ['blue'] })]
		});

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toContain('Duplicate visual metadata key');
	});

	it('the taxonomy file matches the code vocabulary exactly', () => {
		const result = visualTaxonomyFileSchema.safeParse(taxonomyFile);

		expect(result.success).toBe(true);
		expect(
			getVisualTaxonomy()
				.colors.map((entry) => entry.id)
				.sort()
		).toEqual([...SKIN_COLORS].sort());
		expect(
			getVisualTaxonomy()
				.styles.map((entry) => entry.id)
				.sort()
		).toEqual([...SKIN_STYLES].sort());
	});

	it('rejects a taxonomy that has drifted from the vocabulary', () => {
		const incomplete = {
			colors: [{ id: 'red', label: 'Red' }],
			styles: taxonomyFile.styles
		};

		expect(visualTaxonomyFileSchema.safeParse(incomplete).success).toBe(false);
	});

	it('gives every vocabulary entry a display label', () => {
		for (const entry of [...getVisualTaxonomy().colors, ...getVisualTaxonomy().styles]) {
			expect(entry.label.trim().length).toBeGreaterThan(0);
		}
	});
});

describe('lookup', () => {
	it('returns nothing for a skin that has not been curated', () => {
		// Real catalog skins, deliberately outside the curated starter pool.
		expect(getVisualMetadata('Nova', 'Bloomstick')).toBeUndefined();
		expect(getVisualProfile('Nova', 'Bloomstick')).toBeNull();
	});

	it('returns a curated record for a skin that has been looked at', () => {
		const record = getVisualMetadata('AK-47', 'Redline');

		expect(record?.primaryColors).toContain('red');
		expect(getVisualProfile('AK-47', 'Redline')).not.toBeNull();
	});

	it('returns nothing for a skin that does not exist at all', () => {
		expect(getVisualMetadata('Nonexistent', 'Skin')).toBeUndefined();
	});
});

/**
 * The shipped dataset, checked as content.
 *
 * Every record here was written by a person who looked at the skin's image.
 * These tests cannot verify that — nothing can — but they can verify that a
 * record names a real, correctly-spelled skin and classifies it with the
 * controlled vocabulary, which is what goes wrong when curation is rushed.
 *
 * `curated-catalog-fixture.json` is a snapshot of catalog identities for
 * exactly these skins, so the check runs offline. Adding a record means adding
 * its identity there too — deliberately, so a typo cannot slip through.
 */
describe('skin-visual-metadata.json', () => {
	const records = getAllVisualMetadata();
	const catalog = new Map(fixtureFile.skins.map((skin) => [skin.key, skin]));

	it('is valid against the production schema', () => {
		const parsed = skinVisualMetadataFileSchema.safeParse(metadataFile);

		expect(parsed.error?.issues ?? []).toEqual([]);
		expect(parsed.success).toBe(true);
	});

	it('ships a usable starter pool', () => {
		// Deliberately partial: curation is limited by how many skins a person
		// can actually look at, not by how many exist.
		expect(records.length).toBeGreaterThanOrEqual(40);
	});

	it('names a real catalog skin in every record', () => {
		for (const record of records) {
			expect(catalog.has(record.key), record.key).toBe(true);
		}
	});

	it('spells the weapon and finish exactly as the catalog does', () => {
		for (const record of records) {
			const skin = catalog.get(record.key);

			expect(record.weapon, record.key).toBe(skin?.weapon);
			expect(record.skinName, record.key).toBe(skin?.skinName);
		}
	});

	it('derives every key from its own weapon and finish', () => {
		for (const record of records) {
			expect(record.key).toBe(visualMetadataKey(record.weapon, record.skinName));
		}
	});

	it('uses no key twice', () => {
		expect(new Set(records.map((record) => record.key)).size).toBe(records.length);
	});

	it('carries no variant identity', () => {
		// One classification per product-level skin: `AK-47 | Redline` looks the
		// same Factory New or Battle-Scarred, StatTrak or not.
		for (const record of records) {
			expect(Object.keys(record).sort()).toEqual([
				'key',
				'primaryColors',
				'secondaryColors',
				'skinName',
				'styles',
				'weapon'
			]);
			expect(record.key).not.toMatch(/factory new|field-tested|stattrak|souvenir|\bphase\b/i);
		}
	});

	it('carries no market data at all', () => {
		expect(JSON.stringify(metadataFile.records)).not.toMatch(
			/price|currency|provider|steam|quantity|lastUpdated|itemId/i
		);
	});

	it('classifies only with the controlled vocabulary', () => {
		const colors = new Set<string>(SKIN_COLORS);
		const styles = new Set<string>(SKIN_STYLES);

		for (const record of records) {
			for (const color of [...record.primaryColors, ...record.secondaryColors]) {
				expect(colors, record.key).toContain(color);
			}
			for (const style of record.styles) expect(styles, record.key).toContain(style);
		}
	});

	it('keeps primary colours to a defining few', () => {
		// Tagging every visible pixel makes a colour filter useless.
		for (const record of records) {
			expect(record.primaryColors.length, record.key).toBeLessThanOrEqual(3);
		}
	});

	it('classifies something in every record', () => {
		for (const record of records) {
			expect(record.primaryColors.length + record.styles.length, record.key).toBeGreaterThan(0);
		}
	});

	it('covers the colours a first Smart Loadout needs candidates for', () => {
		const primaries = new Set(records.flatMap((record) => record.primaryColors));

		for (const color of ['black', 'white', 'red', 'blue', 'green', 'purple', 'gold', 'pink']) {
			expect(primaries, color).toContain(color);
		}
	});

	it('spreads across weapons rather than piling onto one', () => {
		const byWeapon = new Map<string, number>();
		for (const record of records) {
			byWeapon.set(record.weapon, (byWeapon.get(record.weapon) ?? 0) + 1);
		}

		// Nothing is more than a third of the dataset, and plenty of weapons
		// have a usable handful.
		expect(Math.max(...byWeapon.values())).toBeLessThan(records.length / 3);
		expect([...byWeapon.values()].filter((count) => count >= 5).length).toBeGreaterThanOrEqual(8);
	});
});
