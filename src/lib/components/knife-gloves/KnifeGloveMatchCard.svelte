<script lang="ts">
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatMoney } from '$lib/formatters/currency';
	import type { KnifeGloveMatch } from '$lib/types/knife-gloves';

	/**
	 * One counterpart, with what it costs and what the pair costs.
	 *
	 * Purely presentational: every price, total and link arrives prepared. It is
	 * not `SkinCard` because it carries two prices and two actions, and widening
	 * that card to cover this would have given the catalog grid a mode it never
	 * uses.
	 *
	 * The pair total is the arithmetic of two lowest asks and nothing more. The
	 * page-level note says so once; repeating the caveat on six cards would be
	 * noise.
	 */
	let {
		match,
		detailHref,
		builderHref
	}: {
		match: KnifeGloveMatch;
		/** Skin page, at the exact variant priced here. */
		detailHref: string;
		/** `/build` with this pair encoded. Absent if it could not be built. */
		builderHref?: string;
	} = $props();

	const finish = $derived(match.name || match.weapon);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<li class="flex flex-col rounded-lg border border-border bg-card">
	<div class="overflow-hidden border-b border-border">
		<SkinImage src={match.imageUrl} alt={match.fullName} decorative />
	</div>

	<div class="flex flex-1 flex-col gap-3 p-3">
		<div class="min-w-0">
			<p class="truncate text-xs text-muted-foreground">{match.weapon}</p>
			<p class="text-sm leading-snug font-medium break-words text-foreground">{finish}</p>
			<span class="mt-1.5 flex flex-wrap items-center gap-1.5">
				{#if match.variant.wear}
					<SkinWearBadge wear={match.variant.wear} />
				{/if}
				<SkinRarity rarity={match.rarity} />
			</span>
		</div>

		<div class="mt-auto space-y-3">
			<div>
				{#if match.price}
					<PriceDisplay amountMinor={match.price.amountMinor} currency={match.price.currency} />
					<p class="truncate text-xs text-subtle-foreground">
						{match.price.providerName ?? match.price.providerId}
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">Price temporarily unavailable</p>
				{/if}
			</div>

			<div class="border-t border-border pt-3">
				<p class="text-xs text-subtle-foreground">Pair total</p>
				{#if match.pairTotal}
					<p class="font-mono text-sm font-medium text-foreground tabular-nums">
						{formatMoney(match.pairTotal.amountMinor, match.pairTotal.currency)}
					</p>
				{:else}
					<!-- Half a total presented as a total is worse than none. -->
					<p class="text-sm text-muted-foreground">Unavailable</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<Button href={detailHref} variant="outline" size="sm" class="w-full">
					View {finish}
				</Button>
				{#if builderHref}
					<Button href={builderHref} size="sm" class="w-full">
						<!-- Repeated six times, so the name has to say which pair. -->
						Open pair in Builder<span class="sr-only"> with {match.fullName}</span>
					</Button>
				{/if}
			</div>
		</div>
	</div>
</li>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
