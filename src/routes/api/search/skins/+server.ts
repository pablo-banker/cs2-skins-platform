/**
 * Global search, for the browser.
 *
 * The search dialog cannot call the catalog service directly — that is
 * server-only, and CS2Cap must never be reachable from a browser — so this is
 * the application-facing seam between the two. It answers from the cached
 * catalog index, which means typing costs no upstream request.
 *
 * Public and read-only, so the query is validated and the response carries
 * only what the dialog renders.
 */
import { json } from '@sveltejs/kit';
import {
	SEARCH_RESULT_LIMIT,
	normalizeSearchQuery,
	skinSearchQuerySchema
} from '$lib/schemas/search';
import { searchSkinSuggestions } from '$lib/server/services/catalog';
import type { SkinSearchItem } from '$lib/features/skins/search-result';
import type { RequestHandler } from './$types';

export type SkinSearchResponse = {
	query: string;
	items: SkinSearchItem[];
	/** True when more matched than were returned. */
	hasMore: boolean;
};

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const parsed = skinSearchQuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });

	if (!parsed.success) {
		// The reason is the caller's own input, so it is safe to state plainly;
		// nothing about the catalog or the upstream is revealed.
		return json({ error: 'Invalid search query' }, { status: 400 });
	}

	const query = normalizeSearchQuery(parsed.data.q);

	try {
		const { results, total } = await searchSkinSuggestions(query, SEARCH_RESULT_LIMIT, {
			fetch
		});

		// Same query, same answer, for as long as the catalog index lives.
		setHeaders({ 'cache-control': 'public, max-age=60' });

		return json({
			query,
			items: results,
			hasMore: total > results.length
		} satisfies SkinSearchResponse);
	} catch {
		// Whatever failed upstream is ours to deal with, not the visitor's to
		// read. No status code, no provider name, no error payload.
		return json({ error: 'Search is temporarily unavailable' }, { status: 503 });
	}
};
