/**
 * Catalog operations for the application.
 *
 * This is the boundary product code talks to. Routes and loaders call these
 * functions; they do not call `$lib/server/providers/cs2cap/**` themselves.
 * The provider layer is infrastructure — which upstream we use, and how it is
 * cached, stops here.
 */
import type { CatalogFilters, Skin } from '$lib/types/skin';
import type { ExploreQuery } from '$lib/schemas/explore';
import {
	browseSkinIndex,
	rankSkinsByRelevance,
	type BrowseResult
} from '$lib/features/skins/browse';
import { toSkinSearchItem, type SkinSearchItem } from '$lib/features/skins/search-result';
import { assignSkinSlugs } from '$lib/features/skins/skin-slug';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';
import { getCatalogFilters, getSkinByName, listItemsByType } from '../providers/cs2cap/items';
import { CACHE_TTL } from '../cache/config';
import { cacheKeys } from '../cache/keys';
import { serverCache } from '../cache/ttl-cache';

/**
 * Resolves one skin with **every** variant it has.
 *
 * Always goes through the complete lookup path, so it can never return the
 * page-boundary partial that a search may produce. This is what a skin page
 * and a loadout slot need.
 */
export async function getSkinDetail(
	params: { weapon: string; name: string },
	options: Cs2CapRequestOptions = {}
): Promise<Skin | undefined> {
	const key = cacheKeys.catalogSkin(params.weapon, params.name);

	return serverCache.getOrLoad(key, CACHE_TTL.catalogItem, () => getSkinByName(params, options));
}

/**
 * The catalog's filter vocabulary, so discovery filters follow the catalog
 * instead of a hardcoded list. Cached hard — it barely moves between game
 * updates.
 */
export async function getCatalogMetadata(
	options: Cs2CapRequestOptions = {}
): Promise<CatalogFilters> {
	return serverCache.getOrLoad(cacheKeys.catalogMetadata(), CACHE_TTL.catalogMetadata, () =>
		getCatalogFilters(options)
	);
}

/**
 * The item type Explore browses.
 *
 * The product is about skins, and the catalog also carries stickers, charms,
 * graffiti, patches, agents and cases — 24,000 entries that are not skins and
 * would dilute every search. Widening this is a product decision, not a
 * configuration tweak.
 */
const BROWSABLE_ITEM_TYPE = 'Weapon';

/**
 * Every browsable skin, grouped and slugged, held in memory.
 *
 * CS2Cap pages over *catalog entries* — roughly eleven per skin, one per
 * exterior and special finish — and has no sort parameter. Paging that way
 * would give Explore variable page sizes, a total that counts exteriors rather
 * than skins, and sorting that only ever covered the current page. So the
 * index is loaded once (a single ~20MB request covering 21,500 entries, which
 * group into about 1,970 skins) and every filter, sort and page is then
 * answered from memory: honest totals, stable pages, catalog-wide ordering,
 * and no upstream request per interaction.
 *
 * Grouping the whole catalog at once also means these skins carry their
 * **complete** variant sets, unlike a page-scoped search.
 */
async function getSkinIndex(options: Cs2CapRequestOptions = {}): Promise<Map<string, Skin>> {
	return serverCache.getOrLoad(
		cacheKeys.catalogIndex(BROWSABLE_ITEM_TYPE),
		CACHE_TTL.catalogIndex,
		async () => assignSkinSlugs(await listItemsByType(BROWSABLE_ITEM_TYPE, options))
	);
}

/** Every browsable skin, in no particular order. */
export async function getBrowsableSkins(options: Cs2CapRequestOptions = {}): Promise<Skin[]> {
	return [...(await getSkinIndex(options)).values()];
}

/**
 * Every distinct weapon name in the browsable catalog, alphabetically.
 *
 * Catalog metadata publishes weapon *types* but not base names, and the filter
 * needs a stable list that does not change as results narrow — so it comes
 * from the index rather than from whatever is on the current page.
 */
export async function getBrowsableWeapons(options: Cs2CapRequestOptions = {}): Promise<string[]> {
	const skins = await getBrowsableSkins(options);

	return [...new Set(skins.map((skin) => skin.weapon))].sort((a, b) => a.localeCompare(b));
}

/**
 * Explore's catalog query: filter, sort and page, all across the complete
 * matching set.
 */
export async function browseSkins(
	query: ExploreQuery,
	options: Cs2CapRequestOptions = {}
): Promise<BrowseResult> {
	return browseSkinIndex(await getBrowsableSkins(options), query);
}

/**
 * Resolves a route slug to its skin.
 *
 * Slugs are assigned by the index rather than parsed, because the readable
 * form is lossy: two real Desert Eagle finishes differ only by a Japanese
 * numeral that no slug can carry. Looking up what the index assigned is the
 * only way to be sure a URL means what it says.
 */
export async function getSkinBySlug(
	slug: string,
	options: Cs2CapRequestOptions = {}
): Promise<Skin | undefined> {
	return (await getSkinIndex(options)).get(slug);
}

export type SkinSuggestions = {
	results: SkinSearchItem[];
	/** Matches beyond the returned ones, so the UI can offer "view all". */
	total: number;
};

/**
 * The best few matches for global search.
 *
 * Reads the same cached index Explore browses — so typing in the search dialog
 * costs no upstream request — and ranks with the same algorithm, so a skin
 * cannot appear in a different order depending on which search found it.
 * Results are narrowed to the small shape the dialog renders.
 */
export async function searchSkinSuggestions(
	query: string,
	limit: number,
	options: Cs2CapRequestOptions = {}
): Promise<SkinSuggestions> {
	const { results, total } = rankSkinsByRelevance(await getBrowsableSkins(options), query, limit);

	return { results: results.map(toSkinSearchItem), total };
}
