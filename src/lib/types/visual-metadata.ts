/**
 * Visual curation vocabulary and types.
 *
 * CS2Cap tells us what a skin *is* — weapon, finish, rarity, collection, wear.
 * It does not tell us what a skin *looks like* in the terms players actually
 * shop in: "a red AK", "a clean black loadout". That judgement is ours, it is
 * curated by hand, and it lives here.
 *
 * This module is the **single source of truth for the vocabulary**. The Zod
 * schemas, the taxonomy JSON and the curated dataset are all validated against
 * these arrays; nothing redefines them.
 */
import type { Skin } from './skin';

/**
 * Controlled colour vocabulary.
 *
 * Deliberately coarse. Near-duplicates (violet, navy, crimson, lime) are left
 * out because a filter that splits "purple" from "violet" makes curation
 * arbitrary and the UI worse — a visitor looking for a purple loadout does not
 * care which word we picked. Widen this only when a product requirement forces
 * it, and see docs/VISUAL_METADATA.md before doing so.
 */
export const SKIN_COLORS = [
	'black',
	'white',
	'gray',
	'silver',
	'red',
	'orange',
	'yellow',
	'gold',
	'green',
	'cyan',
	'blue',
	'purple',
	'pink',
	'brown',
	'multicolor'
] as const;

export type SkinColor = (typeof SKIN_COLORS)[number];

/**
 * Controlled style vocabulary.
 *
 * Small on purpose: a tag nobody can apply consistently is worse than no tag.
 * Every entry here should be a judgement two curators would agree on.
 */
export const SKIN_STYLES = [
	'clean',
	'minimal',
	'dark',
	'colorful',
	'neon',
	'military',
	'futuristic',
	'cyberpunk',
	'anime',
	'classic'
] as const;

export type SkinStyle = (typeof SKIN_STYLES)[number];

/**
 * How a skin looks — the part the product consumes.
 *
 * `primaryColors` are the colours that define the skin at a glance; a card in
 * a grid reads as those colours. `secondaryColors` are present and worth
 * matching on, but would not be how someone describes the skin. That
 * distinction is what lets a future Smart Loadout prefer a genuinely red AK
 * over one with a red stripe.
 */
export type SkinVisualProfile = {
	primaryColors: SkinColor[];
	secondaryColors: SkinColor[];
	styles: SkinStyle[];
};

/**
 * One curated record, as stored in `src/lib/data/skin-visual-metadata.json`.
 *
 * `weapon` and `skinName` are carried alongside the key so the file stays
 * readable by the human curating it — a reviewer should be able to read a diff
 * without decoding slugs.
 */
export type SkinVisualMetadata = SkinVisualProfile & {
	/** Canonical product-level key, e.g. `ak-47::redline`. */
	key: string;
	weapon: string;
	skinName: string;
};

/**
 * A catalog skin with whatever curation we have for it.
 *
 * `visual` is `null` for anything not curated yet, which is most of the
 * catalog and always will be for a while. An uncurated skin is still a real,
 * buyable, searchable skin — it simply cannot be found by colour.
 */
export type DiscoverableSkin = Skin & {
	visual: SkinVisualProfile | null;
};

/** One vocabulary entry with its display label, for future filter UI. */
export type VisualTaxonomyEntry<T extends string> = {
	id: T;
	label: string;
};

/**
 * The shape of `src/lib/data/visual-taxonomy.json`: display labels and
 * presentation order for the vocabularies above. It carries no vocabulary of
 * its own — it is validated to match exactly.
 */
export type VisualTaxonomy = {
	colors: VisualTaxonomyEntry<SkinColor>[];
	styles: VisualTaxonomyEntry<SkinStyle>[];
};
