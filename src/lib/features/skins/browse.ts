/**
 * Filtering, sorting and paging the skin catalog.
 *
 * Pure functions over an in-memory index — no I/O, so the whole thing is
 * trivially testable and costs nothing to run per request.
 */
import type { Skin } from '$lib/types/skin';
import type { ExploreQuery, ExploreSort } from '$lib/schemas/explore';
import { EXPLORE_PAGE_SIZE } from '$lib/schemas/explore';

export type BrowseResult = {
	skins: Skin[];
	/** Skins matching the filters, across every page. */
	total: number;
	page: number;
	pageSize: number;
	pageCount: number;
};

/**
 * Flattens a name for matching: lowercase, punctuation and separators reduced
 * to single spaces.
 *
 * Without this, the natural way to type a skin's name fails — "karambit
 * doppler" is not a substring of "★ Karambit | Doppler", and neither is
 * "ak 47 redline" of "AK-47 | Redline". The separator is ours to ignore.
 */
function searchable(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * Whether a skin's name contains the query, ignoring case, accents and
 * punctuation.
 *
 * Exported so every search in the product — Explore, global search, the
 * loadout picker — asks the same question. A second matcher would mean a skin
 * that is findable in one place and not in another.
 */
export function matchesText(skin: Skin, q: string): boolean {
	return searchable(skin.fullName).includes(searchable(q));
}

/**
 * How well a skin matches the search text.
 *
 * Lower is better: an exact name, then a name that starts with the text, then
 * anything containing it. CS2Cap's own `q` is a plain substring match with no
 * ranking, so nothing upstream is being discarded here — this is strictly more
 * useful, and it is computed over the complete result set rather than a page.
 *
 * Shared with global search, so a skin ranks the same wherever it is found.
 */
export function relevance(skin: Skin, q: string): number {
	const needle = searchable(q);
	const name = searchable(skin.name);
	const full = searchable(skin.fullName);

	if (name === needle || full === needle) return 0;
	if (name.startsWith(needle)) return 1;
	if (full.startsWith(needle)) return 2;
	if (name.includes(needle)) return 3;

	return 4;
}

function compare(a: Skin, b: Skin, sort: ExploreSort, q?: string): number {
	if (sort === 'name-desc') {
		return b.fullName.localeCompare(a.fullName);
	}

	if (sort === 'name-asc') {
		return a.fullName.localeCompare(b.fullName);
	}

	// Relevance. Without search text there is nothing to rank by, so the
	// default order is alphabetical — deterministic, and the same on every
	// reload, which "whatever the catalog returned" would not be.
	if (q) {
		const difference = relevance(a, q) - relevance(b, q);
		if (difference !== 0) return difference;
	}

	return a.fullName.localeCompare(b.fullName);
}

/** Applies every objective filter in the query to one skin. */
export function matchesQuery(skin: Skin, query: ExploreQuery): boolean {
	if (query.q && !matchesText(skin, query.q.toLowerCase())) return false;
	if (query.weapon && skin.weapon !== query.weapon) return false;
	if (query.weaponType && skin.weaponType !== query.weaponType) return false;
	if (query.rarity && skin.rarity?.name !== query.rarity) return false;
	if (query.collection && skin.collection !== query.collection) return false;

	// Variant-level filters ask whether the skin *has* such a variant — a
	// Factory New filter should keep every skin available Factory New, not
	// only skins whose representative card happens to be Factory New.
	if (query.wear && !skin.variants.some((variant) => variant.wear === query.wear)) return false;
	if (query.stattrak && !skin.variants.some((variant) => variant.statTrak)) return false;
	if (query.souvenir && !skin.variants.some((variant) => variant.souvenir)) return false;

	return true;
}

/**
 * Filters, sorts and pages the index.
 *
 * Sorting happens across the **whole** filtered set before paging, so
 * "Name A–Z" means the catalog in order, not one page shuffled. The requested
 * page is clamped into range rather than returning an empty grid for a URL
 * someone over-typed.
 */
export function browseSkinIndex(index: readonly Skin[], query: ExploreQuery): BrowseResult {
	const q = query.q?.toLowerCase();
	const matched = index.filter((skin) => matchesQuery(skin, query));

	matched.sort((a, b) => compare(a, b, query.sort, q));

	const pageCount = Math.max(1, Math.ceil(matched.length / EXPLORE_PAGE_SIZE));
	const page = Math.min(query.page, pageCount);
	const start = (page - 1) * EXPLORE_PAGE_SIZE;

	return {
		skins: matched.slice(start, start + EXPLORE_PAGE_SIZE),
		total: matched.length,
		page,
		pageSize: EXPLORE_PAGE_SIZE,
		pageCount
	};
}

export type RankedSearch = {
	results: Skin[];
	/** Matches beyond `limit`, so a caller can offer "view all". */
	total: number;
};

/**
 * The best few matches for a search box.
 *
 * Uses exactly the same matching and ranking as Explore — one algorithm, so a
 * skin cannot rank differently depending on which search found it — then takes
 * the top `limit`. Ties fall back to alphabetical order, which keeps the list
 * stable between keystrokes that do not change the match set.
 */
export function rankSkinsByRelevance(
	index: readonly Skin[],
	q: string,
	limit: number
): RankedSearch {
	const needle = q.trim().toLowerCase();
	if (!needle) return { results: [], total: 0 };

	const matched = index.filter((skin) => matchesText(skin, needle));

	matched.sort(
		(a, b) => relevance(a, needle) - relevance(b, needle) || a.fullName.localeCompare(b.fullName)
	);

	return { results: matched.slice(0, limit), total: matched.length };
}
