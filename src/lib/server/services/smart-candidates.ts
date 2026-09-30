/**
 * The pool Smart Loadout will generate from.
 *
 * **Curated skins only.** A generator that could reach for an uncurated skin
 * could not honour a colour preference — it would have nothing to match on —
 * so the candidate set is exactly the part of the catalog someone has looked
 * at. That is a small fraction of 1,974 today, and the product model is built
 * around that rather than pretending otherwise.
 *
 * No prices here. Budgets, totals and marketplace choice are Phase 14's
 * problem, and this makes zero market requests.
 */
import { getBrowsableSkins } from './catalog';
import { enrichSkins, filterByVisual, rankByVisualMatch, type VisualCriteria } from './discovery';
import { getLoadoutSlot, slotAcceptsSkin } from '$lib/config/loadout';
import type { DiscoverableSkin } from '$lib/types/visual-metadata';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

export type CandidateQuery = VisualCriteria & {
	/** A builder slot id. Decides which skins are even eligible. */
	slotId: string;
	/** Cap on returned candidates. Omit for everything compatible. */
	limit?: number;
};

/**
 * Curated, slot-compatible candidates, best visual match first.
 *
 * Reuses the discovery primitives rather than scoring again: `filterByVisual`
 * and `rankByVisualMatch` already decide what "matches red" means, and a
 * second opinion on that would be a bug waiting to surface as two screens
 * disagreeing about the same skin.
 *
 * Ordering is deterministic — equal scores keep catalog order — so the same
 * query always returns the same list.
 */
export async function getCuratedCandidates(
	query: CandidateQuery,
	options: Cs2CapRequestOptions = {}
): Promise<DiscoverableSkin[]> {
	const slot = getLoadoutSlot(query.slotId);
	if (!slot) return [];

	const catalog = await getBrowsableSkins(options);

	const compatible = enrichSkins(catalog.filter((skin) => slotAcceptsSkin(slot, skin)));

	// Uncurated skins are dropped here and nowhere else: everything downstream
	// can then assume a candidate has a visual profile.
	const curated = compatible.filter((skin) => skin.visual !== null);

	const matched = filterByVisual(curated, query);
	const ranked = rankByVisualMatch(matched, query);

	return query.limit === undefined ? ranked : ranked.slice(0, query.limit);
}

/** How many curated candidates a slot has, for coverage reporting. */
export async function countCuratedCandidates(
	slotId: string,
	options: Cs2CapRequestOptions = {}
): Promise<number> {
	return (await getCuratedCandidates({ slotId }, options)).length;
}
