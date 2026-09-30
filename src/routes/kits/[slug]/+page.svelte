<script lang="ts">
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import KitImageStack from '$lib/components/kit/KitImageStack.svelte';
	import KitItemList from '$lib/components/kit/KitItemList.svelte';
	import KitPriceSummary from '$lib/components/kit/KitPriceSummary.svelte';
	import KitPurchaseStrategy from '$lib/components/kit/KitPurchaseStrategy.svelte';
	import { toPricedKit, unpricedItems } from '$lib/features/kits/pricing';
	import { buildPurchasePlans, buildSteamComparison } from '$lib/features/kits/purchase-strategy';
	import { pageTitle } from '$lib/config/site';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kit = $derived(data.kit);
	const direction = $derived(
		kit.tags.map((tag) => tag[0].toUpperCase() + tag.slice(1)).join(' · ')
	);
	const canonical = $derived(
		new URL(resolve('/kits/[slug]', { slug: kit.slug }), appPage.url.origin).href
	);

	// Everything below is derived from what the loader already fetched. The
	// strategy control changes which of these is shown and never asks for more.
	const priced = $derived(toPricedKit(kit, new Map(data.prices)));
	const missing = $derived(unpricedItems(priced.items));
	const plans = $derived(buildPurchasePlans(priced.items));
	const steam = $derived(plans ? buildSteamComparison(priced.items, plans.lowestPrice) : undefined);
</script>

<svelte:head>
	<title>{pageTitle(`${kit.name} kit`)}</title>
	<meta name="description" content={kit.description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:title" content={pageTitle(`${kit.name} kit`)} />
	<meta property="og:description" content={kit.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<!--
		Deliberately no price in any metadata: a total is current market data and
		would be wrong by the time anything crawled or shared it.
	-->
</svelte:head>

<PageContainer class="space-y-8">
	<nav aria-label="Breadcrumb">
		<ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
			<li>
				<a
					href={resolve('/kits')}
					class="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					Kits
				</a>
			</li>
			<li aria-hidden="true">/</li>
			<li><span class="text-foreground" aria-current="page">{kit.name}</span></li>
		</ol>
	</nav>

	<div class="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
		<div class="overflow-hidden rounded-lg border border-border">
			<KitImageStack items={kit.items} />
		</div>

		<div class="space-y-5">
			<div class="space-y-3">
				<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
					{kit.name}
				</h1>
				<p class="text-base text-muted-foreground">{kit.description}</p>
				<p class="text-sm text-subtle-foreground">{direction} · {kit.items.length} skins</p>
			</div>

			<KitPriceSummary plan={plans?.lowestPrice} {steam} unpricedCount={missing.length} />
		</div>
	</div>

	<section class="space-y-4" aria-labelledby="kit-items-heading">
		<h2 id="kit-items-heading" class="text-base font-semibold text-foreground">Included skins</h2>
		<KitItemList items={priced.items} providers={data.providers} />
		<p class="text-xs text-subtle-foreground">
			Each skin opens at the exterior this kit is built around, where you can compare every
			marketplace.
		</p>
	</section>

	<section class="space-y-4" aria-labelledby="kit-plan-heading">
		<h2 id="kit-plan-heading" class="text-base font-semibold text-foreground">Purchase plan</h2>

		{#if plans}
			<KitPurchaseStrategy {plans} providers={data.providers} />
		{:else}
			<div class="rounded-lg border border-border bg-surface p-6">
				<p class="text-sm font-medium text-foreground">Purchase plan unavailable</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{#if missing.length > 0}
						Current pricing is missing for {missing.length} of {priced.items.length} items.
					{:else}
						Current prices could not be combined into a plan.
					{/if}
				</p>
			</div>
		{/if}
	</section>
</PageContainer>
