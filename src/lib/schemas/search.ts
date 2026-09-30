/**
 * The global search request.
 *
 * The endpoint is public and read-only, so the query is treated as hostile
 * input: trimmed, length-bounded, and never forwarded anywhere raw.
 */
import { z } from 'zod';

/**
 * Below two characters the result set is most of the catalog, which is slow to
 * serialise and useless to read — so the client does not ask and the endpoint
 * does not answer.
 */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** Long enough for any real skin name; short enough to bound the work. */
export const SEARCH_MAX_QUERY_LENGTH = 100;

/** One dialog-sized page of results. Global search does not paginate. */
export const SEARCH_RESULT_LIMIT = 10;

export const skinSearchQuerySchema = z.object({
	q: z
		.string()
		.trim()
		.min(SEARCH_MIN_QUERY_LENGTH, `Search for at least ${SEARCH_MIN_QUERY_LENGTH} characters`)
		.max(SEARCH_MAX_QUERY_LENGTH, 'Search query is too long')
});

export type SkinSearchQuery = z.infer<typeof skinSearchQuerySchema>;

/**
 * Collapses queries that mean the same thing, so they share one cache entry
 * instead of filling the client cache with whitespace and casing variants.
 */
export function normalizeSearchQuery(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Whether a query is worth a request at all. */
export function isSearchable(value: string): boolean {
	const normalized = normalizeSearchQuery(value);

	return (
		normalized.length >= SEARCH_MIN_QUERY_LENGTH && normalized.length <= SEARCH_MAX_QUERY_LENGTH
	);
}
