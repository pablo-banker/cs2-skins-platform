import { QueryClient } from '@tanstack/svelte-query';

/**
 * Default cache/retry policy for every query in the app.
 *
 * SvelteKit `load` functions stay the primary data path (see
 * docs/ARCHITECTURE.md). TanStack Query owns client-side server-state:
 * polling, background refresh, pagination, optimistic updates.
 */
const defaultStaleTime = 60_000;

/**
 * Creates a QueryClient.
 *
 * Must be called per request, never shared as a module-level singleton: on the
 * server a shared client would leak one visitor's cache into another's render.
 * The root layout instantiates one, which gives a fresh client per SSR render
 * and a single long-lived client in the browser.
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: defaultStaleTime,
				gcTime: 5 * 60_000,
				retry: 2,
				retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
				// Market data is refreshed deliberately (explicit refetch, polling on
				// a screen that needs it), not on every window focus.
				refetchOnWindowFocus: false,
				refetchOnReconnect: true
			},
			mutations: {
				retry: 0
			}
		}
	});
}
