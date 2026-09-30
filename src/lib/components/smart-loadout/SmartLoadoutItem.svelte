<script lang="ts">
	import { resolve } from '$app/paths';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import type { GeneratedSmartItem } from '$lib/types/smart-loadout';

	/**
	 * One skin in a generated loadout.
	 *
	 * Shows the exact variant that was priced — the same one the link opens and
	 * the same one the total is built from. The price is the cheapest current
	 * offer at generation time; there is no offer button, because batch pricing
	 * carries no tracked redirect and a button that appeared or vanished with
	 * deployment configuration would be worse than none. Marketplace comparison
	 * lives on the skin page.
	 */
	let { item }: { item: GeneratedSmartItem } = $props();

	// Built from the variant the optimizer chose, not re-derived, so the link
	// can never disagree with the price beside it. Assembled as a string
	// because a `URLSearchParams` here would be a mutable non-reactive object
	// inside a derived — the same reason the search and picker links do it.
	const href = $derived.by(() => {
		const params: string[] = [];

		if (item.variant.wear) params.push(`wear=${encodeURIComponent(item.variant.wear)}`);
		if (item.variant.edition && item.variant.edition !== 'normal') {
			params.push(`edition=${encodeURIComponent(item.variant.edition)}`);
		}
		if (item.variant.phase) params.push(`phase=${encodeURIComponent(item.variant.phase)}`);

		const search = params.join('&');

		return `${resolve('/skins/[slug]', { slug: item.skinSlug })}${search ? `?${search}` : ''}`;
	});

	// A vanilla knife has no finish, so the weapon name is the whole identity.
	const finish = $derived(item.skinName || item.weapon);
</script>

<!--
	The link is assembled from the chosen variant on top of
	`resolve('/skins/[slug]', …)`, which the lint rule cannot see through.
-->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<li class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
	<SkinImage
		src={item.imageUrl}
		alt={item.fullName}
		decorative
		class="w-24 shrink-0 rounded-sm bg-surface-elevated"
		imageClass="p-1"
	/>

	<div class="min-w-0 flex-1">
		<p class="truncate text-xs text-muted-foreground">{item.slotLabel}</p>
		<a
			{href}
			class="block truncate text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		>
			{finish}
		</a>
		<span class="mt-1 flex flex-wrap items-center gap-2">
			{#if item.variant.wear}
				<SkinWearBadge wear={item.variant.wear} />
			{/if}
			<SkinRarity rarity={item.rarity} />
		</span>
	</div>

	<div class="shrink-0 text-right">
		<PriceDisplay
			amountMinor={item.priceMinor}
			currency={item.currency}
			size="sm"
			class="items-end"
		/>
		<span class="mt-0.5 block max-w-32 truncate text-xs text-subtle-foreground">
			{item.providerName ?? item.providerId}
		</span>
	</div>
</li>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
