<script lang="ts">
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinInfo from '$lib/components/skin/SkinInfo.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinRecommendations from '$lib/components/skin/SkinRecommendations.svelte';
	import SkinVariantSelector from '$lib/components/skin/SkinVariantSelector.svelte';
	import WishlistButton from '$lib/components/wishlist/WishlistButton.svelte';
	import PriceComparison from '$lib/components/market/PriceComparison.svelte';
	import PriceHistoryChart from '$lib/components/market/PriceHistoryChart.svelte';
	import { Button } from '$lib/components/ui/button';
	import { bestProvider, toQuoteRows } from '$lib/features/skins/price-comparison';
	import { variantEdition } from '$lib/features/skins/variant-selection';
	import { knifeGlovesHref } from '$lib/schemas/knife-gloves';
	import { KNIFE_SLOT_ID } from '$lib/features/recommendations/knife-gloves';
	import { pageTitle, site } from '$lib/config/site';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const skin = $derived(data.skin);
	const variant = $derived(data.variant);

	const rows = $derived(toQuoteRows(data.prices, data.providers));
	const best = $derived(rows.find((row) => row.best));
	const bestSeller = $derived(bestProvider(data.prices, data.providers));

	// The newest quote timestamp stands for the set: showing a timestamp on
	// every row would be noise, and they move together anyway.
	const updatedAt = $derived(
		rows
			.map((row) => row.quote.updatedAt)
			.filter((value): value is string => Boolean(value))
			.sort()
			.at(-1)
	);

	const title = $derived(`${skin.fullName} prices`);
	const description = $derived(
		`Compare current ${skin.fullName} prices across CS2 marketplaces, and see 30 days of price history.`
	);

	/**
	 * The product page is canonical. Variant query parameters select a view of
	 * the same skin, so every exterior must not become its own indexable page.
	 */
	const canonical = $derived(
		new URL(resolve('/skins/[slug]', { slug: skin.id }), appPage.url.origin).href
	);
</script>

<svelte:head>
	<title>{pageTitle(title)}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:title" content={pageTitle(title)} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	{#if skin.imageUrl}
		<meta property="og:image" content={skin.imageUrl} />
	{/if}
</svelte:head>

<PageContainer class="space-y-10">
	<nav aria-label="Breadcrumb">
		<ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
			<li>
				<a
					href={resolve('/explore')}
					class="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					Explore
				</a>
			</li>
			<li aria-hidden="true">/</li>
			<li>
				<a
					href="{resolve('/explore')}?weapon={encodeURIComponent(skin.weapon)}"
					class="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					{skin.weapon}
				</a>
			</li>
			<li aria-hidden="true">/</li>
			<li><span class="text-foreground" aria-current="page">{skin.name}</span></li>
		</ol>
	</nav>

	<!-- Which skin, which variant, what it costs — in that order. -->
	<div class="grid gap-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
		<div class="overflow-hidden rounded-lg border border-border bg-card">
			<SkinImage
				src={variant.imageUrl ?? skin.imageUrl}
				alt={skin.fullName}
				loading="eager"
				decorative
			/>
		</div>

		<div class="space-y-6">
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">{skin.weapon}</p>
				<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
					{skin.name}
				</h1>
				<div class="flex flex-wrap items-center gap-3">
					<SkinRarity rarity={skin.rarity} class="text-sm" />
					{#if skin.collection}
						<span class="text-sm text-subtle-foreground">{skin.collection}</span>
					{/if}
				</div>
			</div>

			<SkinVariantSelector {skin} {variant} />

			<!--
				A secondary action, placed under the variant selector rather than
				beside the best price: saving is something someone does *after*
				deciding, and a heart competing with "View offer" would be
				fighting the page's own purpose.

				It takes the selected variant, so switching exterior correctly
				changes what the button is talking about — and the snapshot it
				would save.
			-->
			<WishlistButton
				skinSlug={skin.id}
				variant={{ wear: variant.wear, edition: variantEdition(variant), phase: variant.phase }}
				currentPrice={best && data.prices?.currency
					? { amountMinor: best.quote.priceMinor, currency: data.prices.currency }
					: undefined}
			/>
		</div>
	</div>

	<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
		<PriceComparison
			{rows}
			{best}
			bestProvider={bestSeller}
			failed={data.prices === null}
			currency={data.prices?.currency}
			{updatedAt}
		/>

		<SkinInfo {skin} {variant} />
	</div>

	{#if data.history}
		<PriceHistoryChart points={data.history.points} currency={data.history.currency} />
	{:else}
		<section class="space-y-4" aria-labelledby="price-history-heading">
			<h2 id="price-history-heading" class="text-base font-semibold text-foreground">
				Price history
			</h2>
			<p
				class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground"
			>
				Price history unavailable.
			</p>
		</section>
	{/if}

	{#if data.matcherSlot}
		<!--
			Only for a curated knife or pair of gloves, and only down here: price
			comparison is what this page is for, and a second feature competing
			with it in the hero would be the wrong trade.
		-->
		<section
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
			aria-labelledby="matcher-cta-heading"
		>
			<div class="min-w-0">
				<h2 id="matcher-cta-heading" class="text-base font-semibold text-foreground">
					{data.matcherSlot === KNIFE_SLOT_ID ? 'Find matching gloves' : 'Find matching knives'}
				</h2>
				<p class="text-sm text-muted-foreground">
					See curated {data.matcherSlot === KNIFE_SLOT_ID ? 'gloves' : 'knives'} that pair with this look,
					priced together.
				</p>
			</div>

			<!-- Carries the exact variant on screen, so the matcher prices the
				same thing this page is showing. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<Button
				href="{resolve('/knife-gloves')}{knifeGlovesHref(skin.id, {
					wear: variant.wear,
					phase: variant.phase
				})}"
				variant="outline"
			>
				{data.matcherSlot === KNIFE_SLOT_ID ? 'Find matching gloves' : 'Find matching knives'}
			</Button>
		</section>
	{/if}

	<!--
		Recommendations come after the market data on purpose. The core product
		is price comparison; visual discovery is what someone does once that
		question is answered. Both sections render nothing at all when the skin
		has no curated visual profile — see `docs/RECOMMENDATIONS.md`.
	-->
	<SkinRecommendations
		id="similar-skins-heading"
		heading="Similar skins"
		description="More {skin.weapon} skins with a similar visual direction."
		items={data.recommendations.similar}
	/>

	<SkinRecommendations
		id="matching-skins-heading"
		heading="Matches this skin"
		description="Curated skins that pair with this look."
		items={data.recommendations.matches}
		maxColumns={6}
	/>

	<p class="text-xs text-subtle-foreground">
		Prices are compared through {site.name}'s market data provider and link out to the marketplace. {site.name}
		does not sell skins.
	</p>
</PageContainer>
