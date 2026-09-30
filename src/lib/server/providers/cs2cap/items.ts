/**
 * CS2Cap catalog access (`GET /items`, `GET /items/metadata`).
 *
 * Returns our domain types only. Callers never see a catalog row.
 */
import type { CatalogFilters, Skin } from '$lib/types/skin';
import { CS2CAP_BULK_TIMEOUT_MS, requestCs2Cap, type Cs2CapRequestOptions } from './client';
import { groupItemsIntoSkins, toCatalogFilters } from './mappers';
import { cs2capItemsMetadataSchema, cs2capItemsResponseSchema } from './schemas';

/** Keeps a stray `limit=50000` from turning one lookup into a full catalog dump. */
const MAX_SEARCH_LIMIT = 200;

/**
 * Fetches one skin with every variant it has.
 *
 * Filtering on base and skin name upstream means the whole variant set arrives
 * together, which is what a skin page needs and what a paginated search cannot
 * promise.
 */
export async function getSkinByName(
	params: { weapon: string; name: string },
	options: Cs2CapRequestOptions = {}
): Promise<Skin | undefined> {
	const response = await requestCs2Cap(
		'/items',
		{
			schema: cs2capItemsResponseSchema,
			query: {
				base_name: params.weapon,
				skin_name: params.name,
				limit: MAX_SEARCH_LIMIT
			}
		},
		options
	);

	const [skin] = groupItemsIntoSkins(response.items);
	return skin;
}

/**
 * Every catalog entry of one item type, grouped into product-level skins.
 *
 * `limit` is deliberately omitted: CS2Cap returns the whole matching set in a
 * single response, which is what makes one request enough to build a complete,
 * self-consistent index. It is tens of megabytes and takes seconds, hence the
 * bulk timeout — callers are expected to cache the result, not to call this
 * per request.
 */
export async function listItemsByType(
	itemType: string,
	options: Cs2CapRequestOptions = {}
): Promise<Skin[]> {
	const response = await requestCs2Cap(
		'/items',
		{ schema: cs2capItemsResponseSchema, query: { item_type: itemType } },
		{ timeoutMs: CS2CAP_BULK_TIMEOUT_MS, ...options }
	);

	return groupItemsIntoSkins(response.items);
}

/**
 * The catalog's filter vocabulary (weapon types, wears, rarities, collections,
 * styles), so discovery filters are driven by the catalog instead of a
 * hardcoded list.
 */
export async function getCatalogFilters(
	options: Cs2CapRequestOptions = {}
): Promise<CatalogFilters> {
	const response = await requestCs2Cap(
		'/items/metadata',
		{ schema: cs2capItemsMetadataSchema },
		options
	);

	return toCatalogFilters(response);
}
