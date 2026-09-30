<script lang="ts">
	import { resolve } from '$app/paths';
	import SkinCard from './SkinCard.svelte';
	import type { SkinRecommendation } from '$lib/features/recommendations/skin-recommendations';

	/**
	 * A titled grid of recommended skins.
	 *
	 * Presentational, and route-aware only through `resolve`: every card links
	 * to the canonical product URL, with **no wear in the query**. A
	 * recommendation is product-level visual discovery, so the skin page picks
	 * its own default variant — forcing this card's representative exterior into
	 * the link would make a discovery click look like a deliberate variant
	 * choice.
	 *
	 * `showPrice={false}` is load-bearing: no price was requested for these, and
	 * a card reading "Price unavailable" would claim we looked.
	 */
	let {
		heading,
		description,
		items,
		id,
		/** Widest the grid goes. Fewer, larger cards for a shorter list. */
		maxColumns = 4
	}: {
		heading: string;
		description: string;
		items: SkinRecommendation[];
		/** Anchors the section's accessible name to its heading. */
		id: string;
		maxColumns?: 4 | 6;
	} = $props();

	// Two on a phone either way; the cap keeps cards in a healthy width range
	// rather than letting four items stretch across six columns.
	const columns = $derived(
		maxColumns === 6
			? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
			: 'grid-cols-2 md:grid-cols-4'
	);
</script>

{#if items.length > 0}
	<section class="space-y-4" aria-labelledby={id}>
		<div class="space-y-1">
			<h2 {id} class="text-base font-semibold text-foreground">{heading}</h2>
			<p class="text-sm text-muted-foreground">{description}</p>
		</div>

		<ul class="grid gap-3 {columns}">
			{#each items as item (item.slug)}
				<li class="flex">
					<SkinCard
						skin={item.skin}
						variant={item.variant}
						showPrice={false}
						href={resolve('/skins/[slug]', { slug: item.slug })}
						class="w-full"
					/>
				</li>
			{/each}
		</ul>
	</section>
{/if}
