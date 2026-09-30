<script lang="ts">
	import { resolve } from '$app/paths';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { skinVariantSearch, variantEdition } from '$lib/features/skins/variant-selection';
	import { cheapestQuote, type PricedKitItem } from '$lib/features/kits/pricing';
	import type { MarketProvider } from '$lib/types/provider';

	/**
	 * One skin in a kit, with what it currently costs.
	 *
	 * Shows the **cheapest** offer and where it is — not every marketplace.
	 * The full per-provider comparison lives on the skin page, and repeating it
	 * under each of five items would bury the purchase plan below it.
	 *
	 * The price shown is for the exact variant the kit names, which is also the
	 * variant the link opens and the variant the totals are built from. There
	 * is one item id behind all three.
	 */
	let {
		priced,
		/** The marketplace directory, for a display name. Missing is fine. */
		providers = []
	}: { priced: PricedKitItem; providers?: readonly MarketProvider[] } = $props();

	const skin = $derived(priced.item.skin);
	const variant = $derived(priced.item.variant);
	const quote = $derived(cheapestQuote(priced));
	const providerName = $derived(
		quote
			? (providers.find((entry) => entry.id === quote.providerId)?.name ?? quote.providerId)
			: ''
	);

	const href = $derived(
		`${resolve('/skins/[slug]', { slug: skin.id })}${skinVariantSearch(skin, {
			wear: variant.wear,
			edition: variantEdition(variant),
			phase: variant.phase
		})}`
	);
</script>

<!--
	The link is built by `skinVariantSearch` on top of `resolve('/skins/[slug]',
	…)`, which the lint rule cannot see through.
-->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<li
	class="flex items-center gap-3 rounded-md border border-border bg-surface p-2 transition-colors hover:border-muted-foreground/40 motion-reduce:transition-none"
>
	<a
		{href}
		class="flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
	>
		<SkinImage
			src={variant.imageUrl ?? skin.imageUrl}
			alt={skin.fullName}
			decorative
			class="w-20 shrink-0 rounded-sm"
			imageClass="p-1"
		/>

		<span class="min-w-0 flex-1">
			<span class="block truncate text-xs text-muted-foreground">{skin.weapon}</span>
			<span class="block truncate text-sm font-medium text-foreground">{skin.name}</span>
			<span class="mt-1 flex flex-wrap items-center gap-2">
				<SkinWearBadge wear={variant.wear} />
				{#if variant.statTrak}
					<span class="text-xs text-subtle-foreground">StatTrak</span>
				{/if}
				{#if variant.phase}
					<span class="text-xs text-subtle-foreground">{variant.phase}</span>
				{/if}
				<SkinRarity rarity={skin.rarity} />
			</span>
		</span>
	</a>

	<!--
		Outside the link: a price is information about the row, and nesting it
		inside the skin link would make the whole cell one enormous target whose
		accessible name recited the price.
	-->
	<span class="shrink-0 text-right">
		{#if quote}
			<PriceDisplay
				amountMinor={quote.priceMinor}
				currency={quote.currency}
				size="sm"
				class="items-end"
			/>
			<span class="mt-0.5 block max-w-36 truncate text-xs text-subtle-foreground">
				{providerName}
			</span>
		{:else if priced.state === 'no-quotes'}
			<span class="text-sm text-muted-foreground">No current prices</span>
		{:else}
			<span class="text-sm text-muted-foreground">Price temporarily unavailable</span>
		{/if}
	</span>
</li>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
