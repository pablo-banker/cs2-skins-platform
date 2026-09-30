<script lang="ts">
	import '../app.css';
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { createQueryClient } from '$lib/api/query-client';
	import AppFooter from '$lib/components/layout/AppFooter.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';

	let { children } = $props();

	// One client per component instance: a fresh one per SSR render, a single
	// long-lived one in the browser.
	const queryClient = createQueryClient();

	/**
	 * Throw the server's client away when its render is done.
	 *
	 * The header mounts global search on every page, so every SSR render
	 * creates a Query — and a Query schedules a `gcTime` timer, five minutes
	 * by default here. A live timer is a GC root: it holds the Query, which
	 * holds the QueryCache, the QueryClient and the observer created with
	 * them. Nothing on the server ever unmounts a client, so each render's
	 * objects stayed reachable for the whole five minutes.
	 *
	 * Measured before this: 1,500 requests left 1,503 live QueryClients and
	 * 230MB resident, and a 256MB container died of `Ineffective
	 * mark-compacts near heap limit` at around 7,000 requests. `clear()`
	 * destroys the queries, which cancels the timers and lets the render go.
	 *
	 * Server only. In the browser there is one client and it is supposed to
	 * live as long as the tab — clearing it there would throw away the cache
	 * on every navigation. `onDestroy` is the one lifecycle hook that runs
	 * during SSR, which is exactly why it is the hook used here.
	 */
	if (!browser) {
		onDestroy(() => queryClient.clear());
	}
</script>

<!--
	Deliberately empty of metadata.

	A description here looked like a sensible fallback and was the opposite: it
	is emitted *before* every page's own, and a crawler reads the first one. So
	every carefully written per-page description was being ignored in favour of
	one generic sentence. Each route owns its own title, description and
	canonical; there is nothing site-wide left to say.

	No favicon either. The one that was here was the Svelte logo — the
	framework's default — which branded the product as something it is not.
	There is no project-owned mark yet, and inventing one is a branding
	decision rather than an engineering one.
-->

<QueryClientProvider client={queryClient}>
	<!--
		Sits above everything and stays out of the way until it is tabbed to,
		which is the one moment it matters.
	-->
	<a
		href="#main-content"
		class="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
			focus:not-sr-only focus:fixed focus:top-3 focus:left-1/2 focus:z-50 focus:-translate-x-1/2
			focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
			focus-visible:ring-offset-background focus-visible:outline-none"
	>
		Skip to content
	</a>

	<div class="flex min-h-svh flex-col">
		<AppHeader />

		<!--
			The single `main` landmark for the whole app. Top padding lives here
			so no route has to remember not to collide with the header.
		-->
		<main id="main-content" class="flex-1 py-8 sm:py-10 lg:py-12">
			{@render children()}
		</main>

		<AppFooter />
	</div>
</QueryClientProvider>
