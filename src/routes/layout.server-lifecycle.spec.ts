import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

/**
 * The root layout must throw its QueryClient away at the end of a server
 * render.
 *
 * This is a memory-leak regression, and it was not a small one. The header
 * mounts global search on every page, so every SSR render creates a Query,
 * and a Query schedules a `gcTime` timer. That live timer is a GC root: it
 * holds the Query, the QueryCache, the QueryClient and the request that
 * produced them. Nothing unmounts a client on the server, so every render
 * stayed reachable for the full five minutes.
 *
 * Measured against a production build: 1,500 requests left 1,503 live
 * QueryClients and 1,503 live sockets, and a 256MB container died with
 * `Ineffective mark-compacts near heap limit` at roughly 7,000 requests.
 * After the fix the same run holds flat and the same container survives
 * 9,000.
 *
 * The behaviour lives in a `.svelte` file's script, which a unit test cannot
 * mount on the server — so this pins the guarantee at the source, the way
 * `api/health` pins the imports it must not have.
 */
describe('the root layout on the server', () => {
	const source = readFileSync('src/routes/+layout.svelte', 'utf8');

	it('clears its query client when the render is destroyed', () => {
		expect(source).toMatch(/onDestroy\(\(\) => queryClient\.clear\(\)\)/);
	});

	it('does so only on the server, so the browser keeps its cache', () => {
		// One client lives as long as the tab. Clearing it in the browser
		// would throw the cache away on every navigation, which is the
		// opposite of what the client is for.
		expect(source).toMatch(/if \(!browser\) \{\s*onDestroy/);
		expect(source).toMatch(/from '\$app\/environment'/);
	});
});

describe('clearing a client', () => {
	it('removes the queries that hold the cache alive', () => {
		const client = new QueryClient();
		client.getQueryCache().build(client, { queryKey: ['skin-search', 'ak'] });

		expect(client.getQueryCache().getAll()).toHaveLength(1);

		client.clear();

		expect(client.getQueryCache().getAll()).toHaveLength(0);
	});
});
