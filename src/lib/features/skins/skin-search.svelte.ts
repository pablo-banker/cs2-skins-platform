/**
 * Searching the catalog from the browser.
 *
 * The debounce, the query and the states every search UI needs, in one place.
 * There are two search surfaces now — the header dialog and the homepage hero —
 * and the thing that must not be duplicated is *when* a request goes out and
 * what counts as loading. Two copies of that drift into two different products
 * behaving differently for the same keystroke.
 *
 * What is **not** here is presentation: results, empty states and keyboard
 * behaviour belong to each surface, because a dialog and a page section are
 * genuinely different there.
 *
 * TanStack Query rather than a hand-rolled fetch, for the reasons a search box
 * specifically needs: per-query caching, request deduplication and cancellation.
 * The browser calls our own endpoint, never CS2Cap.
 */
import { createQuery } from '@tanstack/svelte-query';
import { isSearchable, normalizeSearchQuery } from '$lib/schemas/search';
import type { SkinSearchItem } from './search-result';

/** How long typing settles before a request goes out. */
export const SEARCH_DEBOUNCE_MS = 250;

export type SkinSearchResponse = {
	query: string;
	items: SkinSearchItem[];
	hasMore: boolean;
};

export type SkinSearch = {
	/** The normalized query the current results belong to. */
	readonly normalized: string;
	/** True while typing has not settled, or a request is in flight. */
	readonly loading: boolean;
	readonly isError: boolean;
	readonly items: SkinSearchItem[];
	/** Whether the input is long enough to search at all. */
	readonly searchable: boolean;
	retry: () => void;
};

/**
 * Wires an input to the skin search endpoint.
 *
 * `input` is a getter rather than a value so the caller keeps ownership of the
 * field — a search box has to stay responsive on every keystroke, while the
 * query it drives settles first. `active` gates the whole thing, which the
 * header dialog uses to search nothing while it is closed.
 *
 * **No prices.** This is a navigator; comparison lives on the skin page.
 */
export function createSkinSearch(
	input: () => string,
	active: () => boolean = () => true
): SkinSearch {
	let debounced = $state('');

	$effect(() => {
		const value = input();
		const timer = setTimeout(() => (debounced = value), SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timer);
	});

	const normalized = $derived(normalizeSearchQuery(debounced));
	const enabled = $derived(active() && isSearchable(debounced));

	const query = createQuery(() => ({
		// Normalized, so casing and stray spaces share one cache entry rather
		// than each filling the cache with an identical answer.
		queryKey: ['skin-search', normalized],
		enabled,
		staleTime: 5 * 60_000,
		// A failing search should say so quickly, not retry into the silence.
		retry: 1,
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/search/skins?q=${encodeURIComponent(normalized)}`, {
				signal
			});

			if (!response.ok) throw new Error('Search request failed');

			return (await response.json()) as SkinSearchResponse;
		}
	}));

	// Waiting for the debounce is still "searching" from the visitor's side.
	const settling = $derived(isSearchable(input()) && normalizeSearchQuery(input()) !== normalized);

	return {
		get normalized() {
			return normalized;
		},
		get loading() {
			return active() && isSearchable(input()) && (query.isPending || settling);
		},
		get isError() {
			return query.isError;
		},
		get items() {
			return query.data?.items ?? [];
		},
		get searchable() {
			return isSearchable(input());
		},
		retry: () => void query.refetch()
	};
}
