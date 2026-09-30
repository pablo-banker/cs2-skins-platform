<script lang="ts">
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TagsIcon from '@lucide/svelte/icons/tags';
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import HomeSkinSearch from '$lib/components/home/HomeSkinSearch.svelte';
	import ProductWorkflowCard from '$lib/components/home/ProductWorkflowCard.svelte';
	import KitCard from '$lib/components/kit/KitCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { pageTitle, site } from '$lib/config/site';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * What someone can do here, in the order the product expects them to.
	 *
	 * Every one of these is a real, built surface. Nothing aspirational, and
	 * nothing the homepage reimplements — this section names things and links
	 * to them.
	 */
	const workflows = [
		{
			title: 'Compare prices',
			description:
				'Browse the catalog, open a skin, and see what every marketplace is currently asking for that exact exterior.',
			href: resolve('/explore'),
			icon: TagsIcon
		},
		{
			title: 'Build a loadout',
			description:
				'Pick exact skins slot by slot, price what you selected on request, and keep or share the result.',
			href: resolve('/build'),
			icon: LayersIcon
		},
		{
			title: 'Smart Loadout',
			description:
				'Set a budget and a look, and get a core setup put together from our curated skins at current prices.',
			href: resolve('/smart-loadout'),
			icon: SlidersIcon
		},
		{
			title: 'Curated kits',
			description:
				'Hand-picked combinations grouped by colour and style, each priced when you open it.',
			href: resolve('/kits'),
			icon: SparklesIcon
		}
	];

	const title = 'Compare Prices, Build Loadouts & Discover Skins';
	const description =
		'Compare CS2 skin prices across marketplaces, explore the catalog, build loadouts, and discover curated kits and combinations that fit your budget.';

	const canonical = $derived(new URL(resolve('/'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle(title)}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:title" content={pageTitle(title)} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<!--
		No OG image: there is no brand asset yet, and a placeholder would be a
		worse first impression than none. Launch hardening owns site-wide OG.
	-->
</svelte:head>

<PageContainer class="space-y-16 sm:space-y-20">
	<!--
		Hero. Typography and one real interaction, rather than decorative
		imagery — the product is a price comparator, and a search field is the
		most honest thing to put at the front of it.
	-->
	<section class="space-y-6 pt-4 sm:pt-8">
		<div class="max-w-3xl space-y-4">
			<h1
				class="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl"
			>
				Find the right CS2 skin. Pay the right price.
			</h1>
			<p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
				Compare what every marketplace is asking, discover combinations that work together, and
				build a loadout around your style and your budget.
			</p>
		</div>

		<div class="max-w-3xl">
			<HomeSkinSearch />
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<Button href={resolve('/explore')}>Explore skins</Button>
			<Button href={resolve('/build')} variant="outline">Build a loadout</Button>
		</div>

		<p class="text-xs text-subtle-foreground">
			{site.name} compares prices and links out to marketplaces. We don't sell skins.
		</p>
	</section>

	<section class="space-y-6" aria-labelledby="home-workflows-heading">
		<div class="max-w-2xl space-y-2">
			<h2 id="home-workflows-heading" class="text-xl font-semibold tracking-tight text-foreground">
				Where to start
			</h2>
			<p class="text-sm text-muted-foreground">
				Four ways through the same catalog, depending on how much you already know you want.
			</p>
		</div>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each workflows as workflow (workflow.href)}
				<ProductWorkflowCard {...workflow} />
			{/each}
		</div>
	</section>

	<!--
		Smart Loadout gets a section rather than a card: it is the least
		self-explanatory thing here and the hardest to discover by browsing.
	-->
	<section
		class="grid gap-6 rounded-lg border border-border bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
		aria-labelledby="home-smart-heading"
	>
		<div class="max-w-2xl space-y-3">
			<h2 id="home-smart-heading" class="text-xl font-semibold tracking-tight text-foreground">
				Build around your budget
			</h2>
			<p class="text-sm text-muted-foreground sm:text-base">
				Choose a colour and a style, set a maximum, and Smart Loadout puts together a core setup
				from our curated skins using current marketplace prices. It won't spend the whole budget
				just because it's there, and you can open the result in the builder and change anything.
			</p>
		</div>

		<Button href={resolve('/smart-loadout')} class="justify-self-start lg:justify-self-end">
			Build a Smart Loadout
		</Button>
	</section>

	{#if data.kits.length > 0}
		<section class="space-y-6" aria-labelledby="home-kits-heading">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div class="max-w-2xl space-y-2">
					<h2 id="home-kits-heading" class="text-xl font-semibold tracking-tight text-foreground">
						Curated kits
					</h2>
					<p class="text-sm text-muted-foreground">
						Hand-picked sets that share a visual direction. Open one to see its current total and
						the cheapest way to buy it.
					</p>
				</div>

				<Button href={resolve('/kits')} variant="outline" size="sm">View all kits</Button>
			</div>

			<!--
				`KitCard` unchanged, which is what keeps this preview free: kits
				carry no price anywhere, so showing three of them costs nothing.
			-->
			<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.kits as kit (kit.slug)}
					<li class="flex">
						<KitCard {kit} />
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!--
		Deliberately quieter than the Smart panel above: two identically filled
		boxes in a row read as a template rather than a hierarchy.
	-->
	<section
		class="grid gap-4 border-t border-border pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
		aria-labelledby="home-matcher-heading"
	>
		<div class="max-w-2xl space-y-2">
			<h2 id="home-matcher-heading" class="text-xl font-semibold tracking-tight text-foreground">
				Match knives and gloves
			</h2>
			<p class="text-sm text-muted-foreground">
				Start from a knife and see the gloves that go with it, or the other way round. Every pairing
				comes from skins we've looked at by hand, with each side's current price and what the pair
				costs together.
			</p>
		</div>

		<Button
			href={resolve('/knife-gloves')}
			variant="outline"
			class="justify-self-start lg:justify-self-end"
		>
			Find a pairing
		</Button>
	</section>

	<section class="space-y-3 border-t border-border pt-10" aria-labelledby="home-closing-heading">
		<h2 id="home-closing-heading" class="text-xl font-semibold tracking-tight text-foreground">
			Keep an eye on what you want
		</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Save any skin from its page and it lands in your wishlist, where you can see how its price has
			moved since. Everything stays in this browser — there's no account to make.
		</p>
		<div class="flex flex-wrap items-center gap-3 pt-1">
			<Button href={resolve('/explore')}>Start exploring</Button>
			<Button href={resolve('/wishlist')} variant="ghost">View your wishlist</Button>
		</div>
	</section>
</PageContainer>
