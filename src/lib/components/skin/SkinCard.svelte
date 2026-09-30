<script lang="ts">
	import SkinImage from './SkinImage.svelte';
	import SkinRarity from './SkinRarity.svelte';
	import SkinWearBadge from './SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { DISPLAY_CURRENCY } from '$lib/formatters/currency';
	import { cn } from '$lib/utils';
	import type { ResolvedPathname } from '$app/types';
	import type { Skin, SkinVariant } from '$lib/types/skin';

	/**
	 * A skin in a grid: Explore, search results, related skins, kit and
	 * loadout pickers, Smart Loadout results.
	 *
	 * It is presentational and route-agnostic — it takes a `Skin`, optionally
	 * the variant being shown and a price, and fetches nothing. It fills its
	 * grid cell rather than setting a width, so the grid decides the layout.
	 *
	 * The image is the hero: it takes the top of the card, and everything
	 * below it is quiet by comparison.
	 */
	let {
		skin,
		/** The specific variant this card represents, when one is selected. */
		variant,
		/** Lowest ask in integer minor units. Omit when no price is known. */
		priceMinor,
		/**
		 * Whether this card deals in prices at all.
		 *
		 * Catalog browsing deliberately loads no prices — one request per card
		 * would be an N+1 against a metered API — and a card that says "Price
		 * unavailable" because nobody asked for a price is telling the visitor
		 * something untrue. `false` omits the price area entirely; that is
		 * different from `showPrice` with no `priceMinor`, which does mean the
		 * price was looked for and not found.
		 */
		showPrice = true,
		currency = DISPLAY_CURRENCY,
		/** Lead-in above the price. "From" suits a card showing the cheapest variant. */
		priceLabel = 'From',
		/**
		 * Makes the whole card a link. Omit for a non-interactive card.
		 *
		 * Already resolved by the caller: the page knows which route it is
		 * linking to, a presentational card does not.
		 */
		href,
		class: className
	}: {
		skin: Skin;
		variant?: SkinVariant;
		priceMinor?: number | null;
		showPrice?: boolean;
		currency?: string;
		priceLabel?: string;
		href?: ResolvedPathname;
		class?: string;
	} = $props();

	const imageUrl = $derived(variant?.imageUrl ?? skin.imageUrl);
</script>

{#snippet content()}
	<div class="overflow-hidden border-b border-border">
		<SkinImage
			src={imageUrl}
			alt={skin.fullName}
			decorative
			class="transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
		/>
	</div>

	<div class="flex flex-1 flex-col gap-3 p-3">
		<div class="min-w-0">
			<!--
				Weapon above finish, never the two joined again — the card would
				otherwise read "AK-47 · AK-47 | Redline".
			-->
			<p class="truncate text-xs text-muted-foreground">{skin.weapon}</p>
			{#if skin.name}
				<p class="mt-0.5 text-sm leading-snug font-medium break-words text-foreground">
					{skin.name}
				</p>
			{/if}
		</div>

		{#if variant}
			<div class="flex flex-wrap items-center gap-1.5">
				<SkinWearBadge wear={variant.wear} />
				{#if variant.statTrak}
					<span class="text-xs text-subtle-foreground">StatTrak</span>
				{/if}
				{#if variant.souvenir}
					<span class="text-xs text-subtle-foreground">Souvenir</span>
				{/if}
				{#if variant.phase}
					<span class="text-xs text-subtle-foreground">{variant.phase}</span>
				{/if}
			</div>
		{/if}

		<div class="mt-auto flex items-end justify-between gap-2 pt-1">
			{#if showPrice}
				<PriceDisplay amountMinor={priceMinor} {currency} label={priceLabel} />
				<SkinRarity rarity={skin.rarity} class="pb-0.5 text-right" />
			{:else}
				<SkinRarity rarity={skin.rarity} />
			{/if}
		</div>
	</div>
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --
		`href` is a ResolvedPathname: the caller resolved it, which is the only
		place that knows the route. -->
	<a
		{href}
		class={cn(
			'group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
			className
		)}
	>
		{@render content()}
	</a>
{:else}
	<div
		class={cn(
			'group flex flex-col overflow-hidden rounded-lg border border-border bg-card',
			className
		)}
	>
		{@render content()}
	</div>
{/if}
