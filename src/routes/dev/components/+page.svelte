<!--
	DEVELOPER PREVIEW — not part of the product.

	It exists so the domain components can be inspected at real grid widths
	with controlled fixtures. It is dev-only (see +page.ts), is not linked from
	navigation, and fetches nothing.
-->
<script lang="ts">
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import SkinCard from '$lib/components/skin/SkinCard.svelte';
	import SkinCardSkeleton from '$lib/components/skin/SkinCardSkeleton.svelte';
	import SkinImage from '$lib/components/skin/SkinImage.svelte';
	import SkinRarity from '$lib/components/skin/SkinRarity.svelte';
	import SkinWearBadge from '$lib/components/skin/SkinWearBadge.svelte';
	import BestPriceBadge from '$lib/components/market/BestPriceBadge.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import PriceUnavailable from '$lib/components/market/PriceUnavailable.svelte';
	import ProviderLogo from '$lib/components/market/ProviderLogo.svelte';
	import ProviderPriceRow from '$lib/components/market/ProviderPriceRow.svelte';
	import ProviderPriceRowSkeleton from '$lib/components/market/ProviderPriceRowSkeleton.svelte';
	import { pageTitle } from '$lib/config/site';
	import * as fixtures from './fixtures';

	const cardWidths = [220, 260, 300, 360];
	const rarities = [
		'Consumer Grade',
		'Industrial Grade',
		'Mil-Spec Grade',
		'Restricted',
		'Classified',
		'Covert',
		'Contraband',
		'Mythical Ultra Rare'
	];
	const wears = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
</script>

<svelte:head>
	<title>{pageTitle('Component preview')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageContainer class="space-y-12">
	<header class="space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Component preview</h1>
		<p class="text-sm text-muted-foreground">
			Developer-only page for visual checks. Controlled fixtures, no data calls.
		</p>
	</header>

	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-foreground">Skin card at grid widths</h2>
		<div class="flex flex-wrap items-start gap-4">
			{#each cardWidths as width (width)}
				<div class="space-y-2" style="width: {width}px">
					<p class="text-xs text-subtle-foreground">{width}px</p>
					<SkinCard
						skin={fixtures.rifle}
						variant={fixtures.variants.fieldTested}
						priceMinor={12828}
						href="/explore"
					/>
				</div>
			{/each}
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-foreground">Card states</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
			<SkinCard skin={fixtures.noImage} priceMinor={16700} />
			<SkinCard skin={fixtures.knife} variant={fixtures.variants.phased} priceMinor={489900} />
			<SkinCard skin={fixtures.gloves} priceMinor={null} />
			<SkinCard skin={fixtures.longName} variant={fixtures.variants.statTrak} priceMinor={9990} />
			<SkinCard skin={fixtures.unknownRarity} variant={fixtures.variants.souvenir} />
			<SkinCardSkeleton />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-foreground">Provider rows</h2>
		<div class="max-w-md space-y-2">
			<ProviderPriceRow quote={fixtures.quotes.best} provider={fixtures.providers[1]} best />
			<ProviderPriceRow quote={fixtures.quotes.normal} provider={fixtures.providers[0]} />
			<ProviderPriceRow quote={fixtures.quotes.noLink} provider={fixtures.providers[2]} />
			<ProviderPriceRow quote={fixtures.quotes.zero} provider={fixtures.providers[2]} />
			<ProviderPriceRow quote={fixtures.quotes.normal} />
			<ProviderPriceRowSkeleton />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-lg font-semibold text-foreground">Pieces</h2>

		<div class="flex flex-wrap items-center gap-6">
			<PriceDisplay amountMinor={12828} label="From" size="lg" />
			<PriceDisplay amountMinor={489900} label="Best price" />
			<PriceDisplay amountMinor={9990} size="sm" />
			<PriceDisplay amountMinor={0} />
			<PriceUnavailable />
			<BestPriceBadge />
		</div>

		<div class="flex flex-wrap items-center gap-3">
			{#each wears as wear (wear)}
				<SkinWearBadge {wear} />
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-4">
			{#each rarities as name (name)}
				<SkinRarity rarity={{ name }} />
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-3">
			{#each fixtures.providers as provider (provider.id)}
				<ProviderLogo {provider} />
			{/each}
		</div>

		<div class="grid max-w-md grid-cols-3 gap-3">
			<SkinImage src={fixtures.rifle.imageUrl} alt="AK-47 | Redline" />
			<SkinImage src={null} alt="AWP | Neo-Noir" />
			<SkinImage src="https://example.invalid/missing.png" alt="Broken image" />
		</div>
	</section>
</PageContainer>
