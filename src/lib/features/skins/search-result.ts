/**
 * The shape global search sends to the browser.
 *
 * Deliberately smaller than a `Skin`: a result is a navigator, not a product
 * view. Variants, item ids, market hash names, float ranges and collections
 * all stay on the server — shipping them would mean every keystroke moved
 * kilobytes nobody renders.
 */
import type { Skin } from '$lib/types/skin';
import { pickRepresentativeVariant } from './representative-variant';

export type SkinSearchItem = {
	/** Canonical route slug — the same one Explore's cards link to. */
	slug: string;
	weapon: string;
	name: string;
	fullName: string;
	imageUrl?: string;
	rarity?: { name: string };
	/** The exterior a card would show, for a little extra context. */
	representativeWear?: string;
};

/** Narrows a catalog skin to what a search result needs. */
export function toSkinSearchItem(skin: Skin): SkinSearchItem {
	const variant = pickRepresentativeVariant(skin.variants);

	return {
		slug: skin.id,
		weapon: skin.weapon,
		name: skin.name,
		fullName: skin.fullName,
		imageUrl: variant?.imageUrl ?? skin.imageUrl,
		rarity: skin.rarity ? { name: skin.rarity.name } : undefined,
		representativeWear: variant?.wear
	};
}
