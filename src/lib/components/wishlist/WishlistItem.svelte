<script lang="ts">
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatMoney } from '$lib/formatters/currency';
	import { variantSearch } from '$lib/features/skins/variant-selection';
	import { priceChangeSinceAdded } from '$lib/features/wishlist';
	import type { ResolvedWishlistItem } from '$lib/types/wishlist';

	/**
	 * One saved skin, with what it costs now against what it cost when saved.
	 *
	 * Not `SkinCard`: this carries two prices, a movement line and a
	 * destructive control, and widening the catalog card to cover that would
	 * have given every grid in the product a mode it never uses.
	 *
	 * The movement is written from a **buyer's** point of view — lower is good
	 * news, higher is a reason to wait. Nothing here is a profit, a loss or a
	 * return; a wishlist is things somebody might buy, not a portfolio.
	 */
	let {
		item,
		/** The add-time snapshot, held by the browser rather than the server. */
		baseline,
		addedAt,
		onremove
	}: {
		item: ResolvedWishlistItem;
		baseline?: { amountMinor: number; currency: string };
		addedAt?: string;
		onremove: () => void;
	} = $props();

	const finish = $derived(item.name || item.weapon);

	const href = $derived(
		`${resolve('/skins/[slug]', { slug: item.skinSlug })}${variantSearch(item.variant)}`
	);

	const current = $derived(
		item.priceState === 'priced' && item.currentPriceMinor && item.currency
			? { amountMinor: item.currentPriceMinor, currency: item.currency }
			: undefined
	);

	const change = $derived(priceChangeSinceAdded(baseline, current));

	// Secondary by design: useful context, never the headline.
	const added = $derived(
		addedAt
			? new Date(addedAt).toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: undefined
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<li class="flex gap-3 rounded-lg border border-border bg-card p-3 sm:gap-4 sm:p-4">
	<SkinImage
		src={item.imageUrl}
		alt={item.fullName}
		decorative
		class="w-24 shrink-0 self-start rounded-md bg-surface-elevated sm:w-32"
	/>

	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div class="min-w-0">
			<p class="truncate text-xs text-muted-foreground">{item.weapon}</p>
			<a
				{href}
				class="block text-sm leading-snug font-medium break-words text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				{finish}
			</a>
			<span class="mt-1.5 flex flex-wrap items-center gap-2">
				{#if item.variant.wear}
					<SkinWearBadge wear={item.variant.wear} />
				{/if}
				<SkinRarity rarity={item.rarity} />
			</span>
		</div>

		<div class="space-y-1">
			{#if current}
				<PriceDisplay amountMinor={current.amountMinor} currency={current.currency} />
				<p class="truncate text-xs text-subtle-foreground">
					{item.providerName ?? item.providerId}
				</p>
			{:else if item.priceState === 'unpriced'}
				<p class="text-sm text-muted-foreground">No current listings</p>
			{:else}
				<p class="text-sm text-muted-foreground">Current price unavailable</p>
			{/if}

			{#if baseline}
				<p class="text-xs text-subtle-foreground">
					Saved at {formatMoney(baseline.amountMinor, baseline.currency)}
				</p>
			{/if}

			<!--
				Stated in words, not by colour alone: the sentence says which
				direction it moved, and the tone only reinforces it.
			-->
			{#if change?.kind === 'lower'}
				<p class="text-xs font-medium text-success">
					{formatMoney(change.byMinor, change.currency)} lower since added
				</p>
			{:else if change?.kind === 'higher'}
				<p class="text-xs font-medium text-warning">
					{formatMoney(change.byMinor, change.currency)} higher since added
				</p>
			{:else if change?.kind === 'unchanged'}
				<p class="text-xs text-subtle-foreground">No change since added</p>
			{/if}
		</div>

		<div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
			{#if added}
				<p class="text-xs text-subtle-foreground">Added {added}</p>
			{:else}
				<span></span>
			{/if}

			<div class="flex items-center gap-2">
				<Button {href} variant="outline" size="sm">View skin</Button>
				<!--
					`aria-label` rather than an sr-only span: Svelte trims the
					leading whitespace inside an element, so the span approach
					announces "RemoveAK-47 | Redline".
				-->
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onclick={onremove}
					aria-label="Remove {item.fullName}"
				>
					<Trash2Icon class="size-4" aria-hidden="true" />
					Remove
				</Button>
			</div>
		</div>
	</div>
</li>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
