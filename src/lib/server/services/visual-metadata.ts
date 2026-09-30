/**
 * Loads and indexes the curated visual metadata.
 *
 * No network, no cache, no upstream — this is a local JSON file read once per
 * process. It is a *service* rather than a raw import so that nothing else in
 * the application ever parses the file itself, and so the identity rule for a
 * metadata key lives in exactly one place.
 */
import taxonomyFile from '$lib/data/visual-taxonomy.json';
import metadataFile from '$lib/data/skin-visual-metadata.json';
import {
	skinVisualMetadataFileSchema,
	visualTaxonomyFileSchema
} from '$lib/schemas/visual-metadata';
import type {
	SkinVisualMetadata,
	SkinVisualProfile,
	VisualTaxonomy
} from '$lib/types/visual-metadata';

/**
 * Builds the canonical product-level key for a skin.
 *
 * Visual curation describes **a skin**, not a listing: `AK-47 | Redline` looks
 * the same Factory New or Battle-Scarred, StatTrak or not. So the key is built
 * from weapon and finish name only — never from an `item_id`, a wear, a
 * StatTrak flag or a route slug. Item ids identify something to buy; this
 * identifies something to look at.
 *
 * Normalisation is deliberately shallow: case and whitespace are levelled
 * because those vary by accident, while punctuation is left alone because in
 * CS2 it is usually meaningful (`AK-47`, `M4A1-S`, `★ Karambit`, `Desert
 * Eagle`). Stripping it would risk collapsing two genuinely different skins
 * into one key, which is a far worse failure than a key that looks untidy.
 */
export function visualMetadataKey(weapon: string, skinName: string): string {
	const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

	return `${normalize(weapon)}::${normalize(skinName)}`;
}

/** The lookup structure: one pass over the dataset, then O(1) per skin. */
export type VisualMetadataIndex = ReadonlyMap<string, SkinVisualMetadata>;

/**
 * Indexes curated records by key.
 *
 * Exported so tests and future curation tooling can build an index from their
 * own records without touching the production file.
 *
 * @throws if two records share a key — a duplicate means the dataset disagrees
 * with itself, and picking a winner silently would hide it.
 */
export function createVisualMetadataIndex(
	records: readonly SkinVisualMetadata[]
): VisualMetadataIndex {
	const index = new Map<string, SkinVisualMetadata>();

	for (const record of records) {
		if (index.has(record.key)) {
			throw new Error(`Duplicate visual metadata key "${record.key}"`);
		}

		index.set(record.key, record);
	}

	return index;
}

let cachedIndex: VisualMetadataIndex | undefined;
let cachedTaxonomy: VisualTaxonomy | undefined;

/**
 * Parses and indexes the dataset on first use, then reuses it for the life of
 * the process. The dataset is static, so parsing it more than once would be
 * pure waste; doing it lazily keeps importing this module free of side
 * effects.
 *
 * @throws if the file is malformed. Hand-curated data has no API contract
 * protecting it, so a bad record must stop the request rather than quietly
 * degrade discovery.
 */
function getIndex(): VisualMetadataIndex {
	if (!cachedIndex) {
		const parsed = skinVisualMetadataFileSchema.safeParse(metadataFile);

		if (!parsed.success) {
			const where = parsed.error.issues
				.slice(0, 5)
				.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
				.join('; ');

			throw new Error(`skin-visual-metadata.json is invalid — ${where}`);
		}

		cachedIndex = createVisualMetadataIndex(parsed.data.records);
	}

	return cachedIndex;
}

/** The curated record for a skin, or `undefined` if it has not been curated. */
export function getVisualMetadata(
	weapon: string,
	skinName: string
): SkinVisualMetadata | undefined {
	return getIndex().get(visualMetadataKey(weapon, skinName));
}

/**
 * Just the classification, without the curation bookkeeping.
 *
 * This is what gets attached to a skin and sent onward: key, weapon and
 * skinName are already on the skin itself, so repeating them would bloat every
 * payload for nothing.
 */
export function getVisualProfile(weapon: string, skinName: string): SkinVisualProfile | null {
	const record = getVisualMetadata(weapon, skinName);
	if (!record) return null;

	return {
		primaryColors: record.primaryColors,
		secondaryColors: record.secondaryColors,
		styles: record.styles
	};
}

/** Every curated record. Useful for curation tooling and coverage reporting. */
export function getAllVisualMetadata(): SkinVisualMetadata[] {
	return [...getIndex().values()];
}

/** How many skins have been curated so far. */
export function getVisualMetadataCount(): number {
	return getIndex().size;
}

/**
 * Display labels and ordering for the controlled vocabulary.
 *
 * @throws if the taxonomy file has drifted from the code vocabulary.
 */
export function getVisualTaxonomy(): VisualTaxonomy {
	if (!cachedTaxonomy) {
		const parsed = visualTaxonomyFileSchema.safeParse(taxonomyFile);

		if (!parsed.success) {
			const where = parsed.error.issues
				.slice(0, 5)
				.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
				.join('; ');

			throw new Error(`visual-taxonomy.json is invalid — ${where}`);
		}

		cachedTaxonomy = { colors: parsed.data.colors, styles: parsed.data.styles };
	}

	return cachedTaxonomy;
}
