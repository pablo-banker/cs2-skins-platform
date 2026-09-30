<script lang="ts">
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { resolve } from '$app/paths';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import ExploreFilters from './ExploreFilters.svelte';
	import { clearFiltersUrl } from '$lib/features/skins/explore-url';
	import { hasActiveFilters, type ExploreQuery } from '$lib/schemas/explore';
	import type { ExploreFilterOptions } from '$lib/features/skins/explore-options';

	/**
	 * Filters on narrow screens.
	 *
	 * Renders the same `ExploreFilters` as the desktop sidebar — one filter
	 * definition, two placements — inside the accessible Sheet primitive.
	 * Choosing a filter navigates and closes the sheet, so the visitor sees
	 * the results they just asked for.
	 */
	let {
		query,
		options,
		activeCount
	}: { query: ExploreQuery; options: ExploreFilterOptions; activeCount: number } = $props();

	let open = $state(false);
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger
		class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
	>
		<SlidersIcon class="size-4" aria-hidden="true" />
		Filters
		{#if activeCount > 0}
			<span
				class="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
			>
				{activeCount}
			</span>
			<span class="sr-only">{activeCount} active</span>
		{/if}
	</Sheet.Trigger>

	<Sheet.Content side="right" class="w-80 overflow-y-auto">
		<Sheet.Header class="border-b border-border">
			<Sheet.Title class="text-base font-semibold tracking-tight">Filters</Sheet.Title>
			<Sheet.Description class="sr-only">Narrow the catalog results</Sheet.Description>
		</Sheet.Header>

		<div class="px-4 pb-6">
			<ExploreFilters {query} {options} onNavigate={() => (open = false)} />

			{#if hasActiveFilters(query)}
				<Button
					variant="outline"
					class="mt-5 w-full"
					href={resolve(clearFiltersUrl(query) as '/explore')}
					onclick={() => (open = false)}
				>
					Clear all filters
				</Button>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
