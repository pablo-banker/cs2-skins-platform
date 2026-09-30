<script lang="ts">
	import { navigating, page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import SkinCard from '$lib/components/skin/SkinCard.svelte';
	import SkinCardSkeleton from '$lib/components/skin/SkinCardSkeleton.svelte';
	import ActiveFilters from '$lib/components/search/ActiveFilters.svelte';
	import ExploreFilters from '$lib/components/search/ExploreFilters.svelte';
	import ExploreFiltersSheet from '$lib/components/search/ExploreFiltersSheet.svelte';
	import ExplorePagination from '$lib/components/search/ExplorePagination.svelte';
	import ExploreSearch from '$lib/components/search/ExploreSearch.svelte';
	import ExploreSort from '$lib/components/search/ExploreSort.svelte';
	import { Button } from '$lib/components/ui/button';
	import { clearFiltersUrl } from '$lib/features/skins/explore-url';
	import { hasActiveFilters } from '$lib/schemas/explore';
	import { pageTitle, site } from '$lib/config/site';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const query = $derived(data.query);
	const results = $derived(data.results);

	const activeCount = $derived(
		[
			query.q,
			query.weapon,
			query.weaponType,
			query.wear,
			query.rarity,
			query.collection,
			query.stattrak,
			query.souvenir
		].filter(Boolean).length
	);

	const rangeStart = $derived((results.page - 1) * results.pageSize + 1);
	const rangeEnd = $derived(Math.min(results.page * results.pageSize, results.total));

	const numberFormat = new Intl.NumberFormat('en-US');

	// A filter navigation replaces the whole grid; dimming it is enough of a
	// signal without throwing away content the visitor is still reading.
	const pending = $derived(Boolean(navigating.to));

	const canonical = $derived(new URL(resolve('/explore'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle('Explore CS2 skins')}</title>
	<meta
		name="description"
		content="Browse and filter the full CS2 skin catalog by weapon, exterior, rarity and collection, then compare prices across marketplaces."
	/>
	<!--
		Canonical is the bare catalog, whatever the filters say.
		Weapon × wear × rarity × collection × sort × page multiplies into tens
		of thousands of URLs that are all the same catalog seen through a
		different lens. The skins themselves are the indexable pages, and each
		has its own.
	-->
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-6">
	<header class="space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Explore skins</h1>
		<p class="text-sm text-muted-foreground">
			Browse the CS2 catalog and filter by weapon, exterior, rarity and collection.
		</p>
	</header>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<div class="flex-1"><ExploreSearch {query} /></div>
		<div class="flex items-center gap-2">
			<ExploreFiltersSheet {query} options={data.options} {activeCount} />
			<ExploreSort {query} />
		</div>
	</div>

	<ActiveFilters {query} />

	<div class="flex flex-col gap-8 lg:flex-row lg:items-start">
		<!--
			The sidebar appears at lg. At md the shell already switched to
			desktop navigation, but a 768px viewport minus a 240px sidebar
			leaves cards too narrow to read, so Explore keeps the sheet longer
			than the shell does.
		-->
		<aside class="hidden w-56 shrink-0 lg:block xl:w-64" aria-labelledby="explore-filters-heading">
			<h2 id="explore-filters-heading" class="mb-4 text-sm font-semibold text-foreground">
				Filters
			</h2>
			<ExploreFilters {query} options={data.options} />
		</aside>

		<div class="min-w-0 flex-1 space-y-6">
			{#if data.failed}
				<div class="rounded-lg border border-border bg-surface p-8 text-center">
					<h2 class="text-base font-semibold text-foreground">We couldn't load the catalog</h2>
					<p class="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
						The catalog is temporarily unreachable. Nothing is wrong with your filters.
					</p>
					<Button href={resolve('/explore')} class="mt-5">Try again</Button>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground" aria-live="polite">
					{#if results.total === 0}
						No skins found
					{:else if query.q}
						{numberFormat.format(results.total)}
						{results.total === 1 ? 'skin' : 'skins'} for “{query.q}”
					{:else}
						Showing {numberFormat.format(rangeStart)}–{numberFormat.format(rangeEnd)} of
						{numberFormat.format(results.total)}
						{results.total === 1 ? 'skin' : 'skins'}
					{/if}
				</p>

				{#if results.total === 0}
					<div class="rounded-lg border border-border bg-surface p-8 text-center">
						<h2 class="text-base font-semibold text-foreground">No skins found</h2>
						<p class="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
							Try changing or clearing some filters.
						</p>
						{#if hasActiveFilters(query)}
							<Button
								variant="outline"
								href={resolve(clearFiltersUrl(query) as '/explore')}
								class="mt-5"
							>
								Clear filters
							</Button>
						{/if}
					</div>
				{:else}
					<div
						class="grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5 {pending
							? 'opacity-60'
							: ''}"
					>
						{#if pending}
							{#each Array.from({ length: results.skins.length }, (_, i) => i) as index (index)}
								<SkinCardSkeleton />
							{/each}
						{:else}
							{#each results.skins as entry (entry.skin.id)}
								<SkinCard
									skin={entry.skin}
									variant={entry.variant}
									showPrice={false}
									href={resolve('/skins/[slug]', { slug: entry.skin.id })}
								/>
							{/each}
						{/if}
					</div>

					<ExplorePagination {query} page={results.page} pageCount={results.pageCount} />
				{/if}
			{/if}
		</div>
	</div>

	<p class="text-xs text-subtle-foreground">
		Catalog data from {site.name}'s market data provider. Prices are compared on each skin's page.
	</p>
</PageContainer>
