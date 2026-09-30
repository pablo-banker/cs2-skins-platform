<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { resolve } from '$app/paths';
	import { buildExploreUrl, clearFiltersUrl } from '$lib/features/skins/explore-url';
	import { hasActiveFilters, type ExploreParam, type ExploreQuery } from '$lib/schemas/explore';

	/**
	 * What is currently narrowing the results, and how to undo each piece.
	 *
	 * Removing one filter keeps the rest and returns to page one — the URL
	 * utility owns that rule, so a chip cannot get it wrong.
	 */
	let { query }: { query: ExploreQuery } = $props();

	type Chip = { param: ExploreParam; label: string; value: string };

	const chips = $derived(
		[
			query.q && { param: 'q' as const, label: 'Search', value: query.q },
			query.weapon && { param: 'weapon' as const, label: 'Weapon', value: query.weapon },
			query.weaponType && {
				param: 'weaponType' as const,
				label: 'Category',
				value: query.weaponType
			},
			query.wear && { param: 'wear' as const, label: 'Exterior', value: query.wear },
			query.rarity && { param: 'rarity' as const, label: 'Rarity', value: query.rarity },
			query.collection && {
				param: 'collection' as const,
				label: 'Collection',
				value: query.collection
			},
			query.stattrak && { param: 'stattrak' as const, label: 'Finish', value: 'StatTrak only' },
			query.souvenir && { param: 'souvenir' as const, label: 'Finish', value: 'Souvenir only' }
		].filter(Boolean) as Chip[]
	);
</script>

{#if hasActiveFilters(query)}
	<div class="flex flex-wrap items-center gap-2">
		{#each chips as chip (chip.param)}
			<a
				href={resolve(buildExploreUrl(query, { [chip.param]: undefined }) as '/explore')}
				class="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-xs text-foreground transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				<span class="text-muted-foreground">{chip.label}:</span>
				{chip.value}
				<XIcon class="size-3 text-subtle-foreground" aria-hidden="true" />
				<span class="sr-only">Remove {chip.label} filter {chip.value}</span>
			</a>
		{/each}

		<a
			href={resolve(clearFiltersUrl(query) as '/explore')}
			class="rounded-sm px-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		>
			Clear all
		</a>
	</div>
{/if}
