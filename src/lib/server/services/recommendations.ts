/**
 * Visual recommendations for a skin page.
 *
 * ```text
 * source skin + verified visual profile
 *            + cached catalog + curated metadata
 *                      ↓
 *        Similar skins · Matches this skin
 * ```
 *
 * **No market service is imported here, and that is enforced by a test.** A
 * skin page already answers the price question for the skin someone opened;
 * pricing eight recommendation cards would be eight more metered requests for
 * cards that deliberately show no price. Recommendations are catalog and
 * judgement, which cost nothing.
 *
 * No cache of its own either. The catalog is already cached, the curated
 * dataset is a static import, and scoring 161 records is a loop.
 */
import { getBrowsableSkins } from './catalog';
import { enrichSkin, enrichSkins } from './discovery';
import { matchingSkins, similarSkins } from '$lib/features/recommendations/skin-recommendations';
import type { SkinRecommendation } from '$lib/features/recommendations/skin-recommendations';
import type { Skin } from '$lib/types/skin';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

export type SkinRecommendations = {
	similar: SkinRecommendation[];
	matches: SkinRecommendation[];
};

/** Nothing to recommend. A real answer, not a failure. */
const NONE: SkinRecommendations = { similar: [], matches: [] };

/**
 * What to show beside this skin, if anything.
 *
 * **An uncurated source returns nothing, before the catalog is even read.**
 * Recommending from a skin nobody has looked at would mean inventing the thing
 * the recommendation is based on, and the page simply omits both sections
 * rather than apologising for our curation backlog in the product.
 */
export async function getSkinRecommendations(
	skin: Skin,
	options: Cs2CapRequestOptions = {}
): Promise<SkinRecommendations> {
	const source = enrichSkin(skin);

	if (!source.visual) return NONE;

	// The whole catalog, enriched once and narrowed to what has been verified.
	// Roughly 8% survives, and only that 8% can be scored at all.
	const curated = enrichSkins(await getBrowsableSkins(options)).filter(
		(candidate) => candidate.visual !== null
	);

	return {
		similar: similarSkins(source, curated),
		matches: matchingSkins(source, curated)
	};
}
