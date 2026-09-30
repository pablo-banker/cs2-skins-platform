/**
 * Choosing what a slot's picker shows.
 *
 * Pure: takes the catalog index the caller already has and returns one bounded
 * page of options. No I/O, so it is the same function whether the index came
 * from a live fetch or a fixture.
 */
import { matchesText, relevance } from '$lib/features/skins/browse';
import { orderedVariants } from '$lib/features/skins/variant-selection';
import { slotAcceptsSkin, type LoadoutSlotConfig } from '$lib/config/loadout';
import { BUILD_PAGE_SIZE } from '$lib/schemas/loadout';
import type { LoadoutSkinOption, LoadoutSkinPage, LoadoutVariantOption } from '$lib/types/loadout';
import type { Skin } from '$lib/types/skin';

/**
 * Narrows a catalog skin to what a picker renders.
 *
 * Variants come along because builder selection needs an **exact** one, and
 * the catalog index is already in memory — so offering the real exteriors
 * costs nothing and means the picker can never present a combination that does
 * not exist. Only the fields the picker draws survive: no floats, no market
 * hash names, no upstream classification.
 */
export function toSkinOption(skin: Skin): LoadoutSkinOption {
	const variants: LoadoutVariantOption[] = orderedVariants(skin).map((variant) => ({
		itemId: variant.itemId,
		wear: variant.wear,
		statTrak: variant.statTrak,
		souvenir: variant.souvenir,
		phase: variant.phase
	}));

	return {
		slug: skin.id,
		weapon: skin.weapon,
		name: skin.name,
		fullName: skin.fullName,
		imageUrl: skin.imageUrl,
		rarity: skin.rarity,
		variants
	};
}

export type PickerQuery = {
	q?: string;
	page: number;
};

/**
 * One page of the skins a slot accepts.
 *
 * With a query, results are ranked by the **shared** relevance function, so a
 * skin cannot sort differently here than in Explore or global search. Without
 * one, alphabetical — a picker with no query has no notion of "best match",
 * and a stable list is easier to scan than an arbitrary one.
 */
export function pickSlotOptions(
	index: readonly Skin[],
	slot: LoadoutSlotConfig,
	query: PickerQuery,
	pageSize: number = BUILD_PAGE_SIZE
): LoadoutSkinPage {
	const compatible = index.filter((skin) => slotAcceptsSkin(slot, skin));
	const needle = query.q?.trim().toLowerCase();

	const matched = needle ? compatible.filter((skin) => matchesText(skin, needle)) : compatible;

	const sorted = [...matched].sort(
		needle
			? (a, b) =>
					relevance(a, needle) - relevance(b, needle) || a.fullName.localeCompare(b.fullName)
			: (a, b) => a.fullName.localeCompare(b.fullName)
	);

	const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
	const page = Math.min(Math.max(1, query.page), pageCount);
	const start = (page - 1) * pageSize;

	return {
		slotId: slot.id,
		options: sorted.slice(start, start + pageSize).map(toSkinOption),
		total: sorted.length,
		page,
		pageCount
	};
}
