/**
 * Editorial kits: curated groups of skins built around a visual theme.
 *
 * **Kits are our product data, not CS2Cap's.** They are written by hand, live
 * in version control, and describe *which skins go together* — never what they
 * cost. Prices, providers and history stay dynamic and are fetched separately;
 * a monetary figure committed to a JSON file is wrong before the commit lands.
 */
import type { Skin, SkinVariant } from './skin';
import type { SkinColor, SkinStyle } from './visual-metadata';
import type { SkinSelection } from '$lib/schemas/skin-detail';

/**
 * What a kit is organised around.
 *
 * Deliberately tiny. A taxonomy with twenty entries is one nobody can apply
 * consistently, and four kits do not need one.
 */
export const KIT_CATEGORIES = ['color', 'style'] as const;

export type KitCategory = (typeof KIT_CATEGORIES)[number];

/**
 * Kit tags reuse the skin visual vocabulary rather than inventing synonyms —
 * "dark" must mean the same thing on a kit as on a skin.
 *
 * A tag describes the kit's editorial direction as a whole. It says nothing
 * about how any individual skin inside it is classified: skin-level curation
 * is independently verified and lives in `skin-visual-metadata.json`.
 */
export type KitTag = SkinColor | SkinStyle;

/**
 * One skin in a kit, referenced by its canonical route slug — the same
 * identity Explore, search and skin details use. Never an upstream item id.
 */
export type EditorialKitItem = {
	skinSlug: string;
	/**
	 * The version of this skin the kit intends.
	 *
	 * Editorial, not a UI default: a kit may deliberately want Field-Tested.
	 * It must name a variant that really exists — an impossible combination is
	 * broken content, not something to silently substitute.
	 */
	variant?: SkinSelection;
};

export type EditorialKit = {
	slug: string;
	name: string;
	/** One sentence. Cards have no room for a paragraph. */
	description: string;
	category: KitCategory;
	tags: KitTag[];
	items: EditorialKitItem[];
};

/** A kit whose skin references have been resolved against the catalog. */
export type ResolvedKitItem = {
	skin: Skin;
	variant: SkinVariant;
};

export type ResolvedKit = Omit<EditorialKit, 'items'> & {
	items: ResolvedKitItem[];
};
