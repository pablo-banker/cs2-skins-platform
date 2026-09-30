<script lang="ts">
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import KnifeGloveMatchCard from '$lib/components/knife-gloves/KnifeGloveMatchCard.svelte';
	import KnifeGloveSourcePanel from '$lib/components/knife-gloves/KnifeGloveSourcePanel.svelte';
	import KnifeGloveSourcePicker from '$lib/components/knife-gloves/KnifeGloveSourcePicker.svelte';
	import { variantSearch } from '$lib/features/skins/variant-selection';
	import { shareUrl } from '$lib/features/loadout/share';
	import { KNIFE_SLOT_ID } from '$lib/features/recommendations/knife-gloves';
	import { pageTitle } from '$lib/config/site';
	import type { KnifeGloveMatch } from '$lib/types/knife-gloves';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const result = $derived(data.result);
	const source = $derived(result.state === 'ready' ? result.source : undefined);

	// "Matching gloves" for a knife, and the reverse. Naming the direction is
	// most of what makes the page legible at a glance.
	const direction = $derived(source?.slotId === KNIFE_SLOT_ID ? 'gloves' : 'knives');

	function detailHref(match: KnifeGloveMatch): string {
		return `${resolve('/skins/[slug]', { slug: match.slug })}${variantSearch(match.variant)}`;
	}

	/**
	 * The pair as an ordinary Builder share link.
	 *
	 * No new handoff format and no new endpoint: the pair arrives at `/build` as
	 * a *shared* loadout, which means it is shown rather than adopted and the
	 * visitor's own saved loadout survives until they edit it.
	 */
	function builderHref(match: KnifeGloveMatch): string | undefined {
		return shareUrl({ selections: match.pairSelections }, appPage.url.origin);
	}

	// `new URL`, not concatenation: `resolve()` returns a path relative
	// to the current URL, so `origin + resolve(…)` yields `host./route`.
	const canonical = $derived(new URL(resolve('/knife-gloves'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle('Knife + Gloves Matcher')}</title>
	<meta
		name="description"
		content="Find curated knife and gloves combinations and compare their current CS2 marketplace prices."
	/>
	<!--
		Canonical is the bare page. The selected source is application state, not
		a separate product to index, and a price in the metadata would be stale
		before it was crawled.
	-->
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-8">
	<header class="max-w-2xl space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
			Knife + Gloves Matcher
		</h1>
		<p class="text-sm text-muted-foreground">
			Find gloves that match your knife, or the other way around. Curated visual matches, shown with
			current marketplace prices.
		</p>
	</header>

	{#if data.catalogFailed}
		<p class="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
			The catalog is temporarily unavailable. Try again in a moment.
		</p>
	{:else if result.state === 'ready'}
		<div class="space-y-8">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0 flex-1 basis-80">
					<KnifeGloveSourcePanel source={result.source} />
				</div>
				<KnifeGloveSourcePicker
					options={data.options}
					label="Change skin"
					selectedSlug={result.source.slug}
				/>
			</div>

			<section class="space-y-4" aria-labelledby="matcher-results-heading">
				<div class="space-y-1">
					<h2 id="matcher-results-heading" class="text-base font-semibold text-foreground">
						Matching {direction}
					</h2>
					<p class="text-sm text-muted-foreground">
						{#if result.matches.length > 0}
							Ranked by how closely they match, from our curated collection. Pair totals combine
							each item's current lowest price, which may be on different marketplaces.
						{:else}
							No strong curated matches yet.
						{/if}
					</p>
				</div>

				{#if result.pricesUnavailable && result.matches.length > 0}
					<p
						class="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
					>
						Current marketplace prices are temporarily unavailable. The matches below are still
						accurate.
					</p>
				{/if}

				{#if result.matches.length > 0}
					<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each result.matches as match (match.slug)}
							<KnifeGloveMatchCard
								{match}
								detailHref={detailHref(match)}
								builderHref={builderHref(match)}
							/>
						{/each}
					</ul>
				{:else}
					<div class="rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
						<p class="text-sm text-muted-foreground">
							We don't have a curated {direction === 'gloves' ? 'pair of gloves' : 'knife'} that matches
							this look yet. Try another skin.
						</p>
					</div>
				{/if}
			</section>
		</div>
	{:else}
		<!--
			Every non-ready state is recoverable selection state, never a route
			error: the picker stays, and the visitor chooses again.
		-->
		<div class="max-w-xl space-y-4 rounded-lg border border-dashed border-border bg-surface/50 p-8">
			{#if result.state === 'unknown-skin'}
				<p class="text-sm font-medium text-foreground">This skin could not be loaded</p>
				<p class="text-sm text-muted-foreground">Choose another knife or gloves skin.</p>
			{:else if result.state === 'wrong-category'}
				<p class="text-sm font-medium text-foreground">This matcher works on knives and gloves</p>
				<p class="text-sm text-muted-foreground">
					Choose a knife or a pair of gloves to find its counterpart.
				</p>
			{:else if result.state === 'uncurated'}
				<p class="text-sm font-medium text-foreground">
					{result.fullName} isn't in our curated matching collection yet
				</p>
				<p class="text-sm text-muted-foreground">Choose another skin.</p>
			{:else}
				<p class="text-sm font-medium text-foreground">Choose a knife or gloves skin</p>
				<p class="text-sm text-muted-foreground">
					We'll show curated matches from the opposite category, with what each one costs right now.
				</p>
			{/if}

			<KnifeGloveSourcePicker options={data.options} />
		</div>
	{/if}
</PageContainer>
