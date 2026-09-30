/**
 * The Explore URL, parsed and validated.
 *
 * Every filter lives in the query string — that is what makes a filtered view
 * shareable, reloadable and indexable. Nothing here trusts the URL: values
 * arrive from whatever someone typed or a crawler invented, so unknown and
 * malformed input is dropped rather than forwarded.
 */
import { z } from 'zod';

/** Skins per page. One fixed value keeps pagination arithmetic honest. */
export const EXPLORE_PAGE_SIZE = 24;

/**
 * Sorts we can perform honestly over the whole result set.
 *
 * `/items` exposes no sort parameter and its `q` is a plain case-insensitive
 * substring match, so there is no upstream ordering to preserve. Every option
 * here is computed over the complete filtered set, never over one page.
 * Price-based sorts are absent on purpose: Explore does not load prices.
 */
export const EXPLORE_SORTS = ['relevance', 'name-asc', 'name-desc'] as const;

export type ExploreSort = (typeof EXPLORE_SORTS)[number];

/** Blank and whitespace-only values mean "no filter", not an empty match. */
const filterText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : undefined))
	.optional();

/** Only an explicit `true` narrows; anything else means "any". */
const onlyFlag = z
	.string()
	.optional()
	.transform((value) => (value === 'true' ? true : undefined));

const pageNumber = z
	.string()
	.optional()
	.transform((value) => {
		const page = Number(value);

		// Garbage, zero and negatives all mean the first page. A visitor who
		// edits the URL badly should land somewhere useful, not on an error.
		return Number.isSafeInteger(page) && page > 0 ? page : 1;
	});

export const exploreQuerySchema = z.object({
	q: filterText,
	weapon: filterText,
	weaponType: filterText,
	wear: filterText,
	rarity: filterText,
	collection: filterText,
	stattrak: onlyFlag,
	souvenir: onlyFlag,
	sort: z
		.string()
		.optional()
		.transform((value) =>
			(EXPLORE_SORTS as readonly string[]).includes(value ?? '')
				? (value as ExploreSort)
				: 'relevance'
		),
	page: pageNumber
});

export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

/** Query keys Explore owns. Anything else in the URL is ignored. */
export const EXPLORE_PARAMS = [
	'q',
	'weapon',
	'weaponType',
	'wear',
	'rarity',
	'collection',
	'stattrak',
	'souvenir',
	'sort',
	'page'
] as const;

export type ExploreParam = (typeof EXPLORE_PARAMS)[number];

/**
 * Parses `URLSearchParams` into a validated query.
 *
 * Total: the schema has a default for every field, so this cannot fail and
 * callers never have to handle a parse error from a URL.
 */
export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
	return exploreQuerySchema.parse({
		q: params.get('q') ?? undefined,
		weapon: params.get('weapon') ?? undefined,
		weaponType: params.get('weaponType') ?? undefined,
		wear: params.get('wear') ?? undefined,
		rarity: params.get('rarity') ?? undefined,
		collection: params.get('collection') ?? undefined,
		stattrak: params.get('stattrak') ?? undefined,
		souvenir: params.get('souvenir') ?? undefined,
		sort: params.get('sort') ?? undefined,
		page: params.get('page') ?? undefined
	});
}

/** Whether any narrowing filter is applied. Sort and page are not filters. */
export function hasActiveFilters(query: ExploreQuery): boolean {
	return Boolean(
		query.q ||
		query.weapon ||
		query.weaponType ||
		query.wear ||
		query.rarity ||
		query.collection ||
		query.stattrak ||
		query.souvenir
	);
}
