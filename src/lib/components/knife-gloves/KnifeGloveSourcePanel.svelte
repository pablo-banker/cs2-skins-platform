<script lang="ts">
	import { resolve } from '$app/paths';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { variantSearch } from '$lib/features/skins/variant-selection';
	import { knifeGlovesHref } from '$lib/schemas/knife-gloves';
	import { KNIFE_SLOT_ID } from '$lib/features/recommendations/knife-gloves';
	import type { KnifeGloveSource } from '$lib/types/knife-gloves';

	/**
	 * The skin being matched against.
	 *
	 * Presentational: it fetches nothing and computes no prices. The exterior
	 * links are real navigations, because the exterior is part of the URL — the
	 * page is shareable at the variant someone is actually looking at.
	 */
	let { source }: { source: KnifeGloveSource } = $props();

	const label = $derived(source.slotId === KNIFE_SLOT_ID ? 'Your knife' : 'Your gloves');
	const finish = $derived(source.name || source.weapon);

	const detailHref = $derived(
		`${resolve('/skins/[slug]', { slug: source.slug })}${variantSearch(source.variant)}`
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section
	class="rounded-lg border border-border bg-surface p-4 sm:p-5"
	aria-labelledby="matcher-source-heading"
>
	<h2 id="matcher-source-heading" class="text-xs font-medium tracking-wide text-muted-foreground">
		{label}
	</h2>

	<div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
		<SkinImage
			src={source.imageUrl}
			alt={source.fullName}
			decorative
			class="w-full shrink-0 rounded-md bg-surface-elevated sm:w-44"
		/>

		<div class="min-w-0 flex-1 space-y-3">
			<div class="min-w-0">
				<p class="truncate text-sm text-muted-foreground">{source.weapon}</p>
				<p class="text-lg font-semibold break-words text-foreground">{finish}</p>
				<span class="mt-1.5 flex flex-wrap items-center gap-2">
					{#if source.variant.wear}
						<SkinWearBadge wear={source.variant.wear} />
					{/if}
					<SkinRarity rarity={source.rarity} />
				</span>
			</div>

			{#if source.price}
				<div>
					<PriceDisplay
						amountMinor={source.price.amountMinor}
						currency={source.price.currency}
						size="lg"
					/>
					<p class="text-xs text-subtle-foreground">
						{source.price.providerName ?? source.price.providerId}
					</p>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Price temporarily unavailable</p>
			{/if}

			{#if source.wears.length > 1}
				<div class="space-y-1.5">
					<p id="matcher-exterior-label" class="text-xs text-subtle-foreground">Exterior</p>
					<div class="flex flex-wrap gap-1.5" role="group" aria-labelledby="matcher-exterior-label">
						{#each source.wears as wear (wear)}
							{@const current = wear === source.variant.wear}
							<a
								href={knifeGlovesHref(source.slug, { wear })}
								aria-current={current ? 'true' : undefined}
								class="rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {current
									? 'border-primary text-foreground'
									: 'border-border text-muted-foreground hover:border-muted-foreground/40'}"
							>
								{wear}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<a
				href={detailHref}
				class="inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				View {finish} details
			</a>
		</div>
	</div>
</section>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
