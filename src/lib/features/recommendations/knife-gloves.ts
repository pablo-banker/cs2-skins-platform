/**
 * Pairing a knife with gloves, or gloves with a knife.
 *
 * The one thing this adds over `Matches this skin` is **focus**. That section
 * spreads six recommendations across the whole loadout, so a knife gets at most
 * one pair of gloves out of it. Someone who has settled on a knife and now wants
 * gloves wants the other twenty-four candidates ranked, not a rifle.
 *
 * Everything else is deliberately unchanged: the same `visualSimilarity`, the
 * same `MIN_VISUAL_SIMILARITY_SCORE`, the same ranking. A dedicated "knife and
 * glove aesthetic" score would mean two skins could match on one page and not on
 * another, which is a bug someone would report as a mystery.
 *
 * Pure: skins in, recommendations out. No catalog, no dataset, no market.
 */
import { slotForSkin } from '$lib/config/loadout';
import { rankedRecommendations, type SkinRecommendation } from './skin-recommendations';
import type { Skin } from '$lib/types/skin';
import type { DiscoverableSkin } from '$lib/types/visual-metadata';

/** The two Builder slots this matcher works between. */
export const KNIFE_SLOT_ID = 'knife';
export const GLOVES_SLOT_ID = 'gloves';

export type EquipmentSlotId = typeof KNIFE_SLOT_ID | typeof GLOVES_SLOT_ID;

/**
 * How many counterparts get priced, and shown.
 *
 * Priced and rendered are the same number on purpose. Pricing more than is
 * displayed would only help if something could knock a candidate out after
 * pricing — and nothing can, because ranking is visual and a missing price is
 * shown rather than hidden. A spare pool would be market traffic bought for
 * nothing.
 */
export const KNIFE_GLOVE_MATCH_LIMIT = 6;

/** Which of the two slots a skin belongs to, if either. */
export function equipmentSlot(skin: Skin): EquipmentSlotId | undefined {
	const slotId = slotForSkin(skin)?.id;

	return slotId === KNIFE_SLOT_ID || slotId === GLOVES_SLOT_ID ? slotId : undefined;
}

/** The category a source pairs *with*. */
export function oppositeEquipmentSlot(slotId: EquipmentSlotId): EquipmentSlotId {
	return slotId === KNIFE_SLOT_ID ? GLOVES_SLOT_ID : KNIFE_SLOT_ID;
}

/**
 * Curated counterparts from the opposite category, best match first.
 *
 * **Opposite category only.** A knife never recommends another knife here —
 * that is `Similar skins` on the knife's own page, and mixing the two would
 * answer a question nobody asked while burying the one they did.
 *
 * Ranked entirely before anything is priced, and never re-ranked afterwards: a
 * cheaper pair is not a better visual match, and letting price reorder this
 * would quietly turn a pairing tool into a cheapest-pair search.
 */
export function knifeGloveMatches(
	source: DiscoverableSkin,
	candidates: readonly DiscoverableSkin[],
	limit: number = KNIFE_GLOVE_MATCH_LIMIT
): SkinRecommendation[] {
	const sourceSlot = equipmentSlot(source);
	if (!sourceSlot || !source.visual) return [];

	const wanted = oppositeEquipmentSlot(sourceSlot);

	return rankedRecommendations(source, candidates)
		.filter((entry) => entry.slotId === wanted)
		.slice(0, limit);
}
