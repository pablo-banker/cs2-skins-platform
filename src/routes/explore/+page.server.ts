/**
 * Explore's catalog load.
 *
 * Server-side because CS2Cap is server-only and the filters have to work on
 * the first render: a filtered URL is shareable, reloadable and indexable only
 * if the server can answer it. Goes through the catalog **service**, never the
 * provider modules.
 */
import { parseExploreQuery } from '$lib/schemas/explore';
import { pickRepresentativeVariant } from '$lib/features/skins/representative-variant';
import { browseSkins, getBrowsableWeapons, getCatalogMetadata } from '$lib/server/services/catalog';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import type { CatalogFilters } from '$lib/types/skin';
import type { PageServerLoad } from './$types';

/**
 * Exteriors read in condition order, not alphabetical — "Battle-Scarred,
 * Factory New, Field-Tested…" is the kind of list that looks automated
 * because it is.
 */
const WEAR_ORDER = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

/** Rarity reads low to high, the way the game presents it. */
const RARITY_ORDER = [
	'Consumer Grade',
	'Industrial Grade',
	'Mil-Spec Grade',
	'Restricted',
	'Classified',
	'Covert',
	'Contraband'
];

/** Orders by a known sequence first, then alphabetically for anything else. */
function ordered(values: string[], sequence: string[]): string[] {
	const rank = new Map(sequence.map((value, index) => [value, index]));

	return [...values].sort(
		(a, b) =>
			(rank.get(a) ?? sequence.length) - (rank.get(b) ?? sequence.length) || a.localeCompare(b)
	);
}

/**
 * Filter vocabularies from catalog metadata, shaped for the UI.
 *
 * Done here so no component ever sees CS2Cap's metadata shape, and so the
 * filters follow the catalog instead of a hardcoded list that rots.
 */
function toFilterOptions(filters: CatalogFilters, weapons: string[]) {
	return {
		weapons,
		weaponTypes: [...filters.weaponTypes].sort((a, b) => a.localeCompare(b)),
		wears: ordered(filters.wears, WEAR_ORDER),
		rarities: ordered(filters.rarities, RARITY_ORDER),
		collections: [...filters.collections].sort((a, b) => a.localeCompare(b))
	};
}

export const load: PageServerLoad = async ({ url, fetch, setHeaders }) => {
	const query = parseExploreQuery(url.searchParams);

	try {
		// All three read the same cached index and metadata, so this is one
		// upstream round of work regardless of how the page was reached.
		const [results, metadata, weapons] = await Promise.all([
			browseSkins(query, { fetch }),
			getCatalogMetadata({ fetch }),
			getBrowsableWeapons({ fetch })
		]);

		// The catalog moves when Valve ships an update, not by the minute.
		setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=300' });

		return {
			query,
			results: {
				...results,
				// The card shows one variant; choosing it on the server keeps the
				// decision in one tested place rather than in the template.
				skins: results.skins.map((skin) => ({
					skin,
					variant: pickRepresentativeVariant(skin.variants)
				}))
			},
			options: toFilterOptions(metadata, weapons),
			failed: false as const
		};
	} catch (cause) {
		// A catalog outage is a page state, not a crash: the filters and the
		// URL still make sense, so the page renders and offers a retry.
		if (cause instanceof CS2CapError) {
			return {
				query,
				results: { skins: [], total: 0, page: 1, pageSize: 0, pageCount: 1 },
				options: { weapons: [], weaponTypes: [], wears: [], rarities: [], collections: [] },
				failed: true as const
			};
		}

		throw cause;
	}
};
