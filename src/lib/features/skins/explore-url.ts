/**
 * Building Explore URLs.
 *
 * One place that knows how to change a filter, so the sidebar, the chips, the
 * sort control, the mobile sheet and the pager cannot drift apart — and so
 * "changing a filter resets the page" is a rule that exists once rather than
 * five times.
 */
import { EXPLORE_PARAMS, type ExploreParam, type ExploreQuery } from '$lib/schemas/explore';

/** Values that mean "no filter" and are dropped rather than written. */
function isEmpty(value: string | boolean | number | undefined | null): boolean {
	return value === undefined || value === null || value === '' || value === false;
}

/** The query as URL parameters, with defaults and empties left out. */
export function exploreParams(query: ExploreQuery): URLSearchParams {
	const params = new URLSearchParams();

	const entries: [ExploreParam, string | boolean | number | undefined][] = [
		['q', query.q],
		['weapon', query.weapon],
		['weaponType', query.weaponType],
		['wear', query.wear],
		['rarity', query.rarity],
		['collection', query.collection],
		['stattrak', query.stattrak],
		['souvenir', query.souvenir],
		// Defaults are omitted so a plain browse stays at a clean `/explore`.
		['sort', query.sort === 'relevance' ? undefined : query.sort],
		['page', query.page > 1 ? query.page : undefined]
	];

	for (const [key, value] of entries) {
		if (!isEmpty(value)) params.set(key, String(value));
	}

	return params;
}

export type ExploreChanges = Partial<Record<ExploreParam, string | boolean | number | undefined>>;

/**
 * An Explore URL with `changes` applied on top of the current query.
 *
 * Any change other than the page itself resets to page one: a visitor who
 * narrows the results while on page 7 wants the narrowed results, not page 7
 * of them — which may not exist.
 */
export function buildExploreUrl(query: ExploreQuery, changes: ExploreChanges = {}): string {
	const params = exploreParams(query);

	for (const key of EXPLORE_PARAMS) {
		if (!(key in changes)) continue;

		const value = changes[key];
		if (isEmpty(value)) params.delete(key);
		else params.set(key, String(value));
	}

	const changedFilter = Object.keys(changes).some((key) => key !== 'page');
	if (changedFilter && !('page' in changes)) params.delete('page');

	const search = params.toString();
	return search ? `/explore?${search}` : '/explore';
}

/** The URL with every filter removed, keeping only how results are ordered. */
export function clearFiltersUrl(query: ExploreQuery): string {
	return buildExploreUrl(query, {
		q: undefined,
		weapon: undefined,
		weaponType: undefined,
		wear: undefined,
		rarity: undefined,
		collection: undefined,
		stattrak: undefined,
		souvenir: undefined,
		page: undefined
	});
}
