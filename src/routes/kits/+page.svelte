<script lang="ts">
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import KitCard from '$lib/components/kit/KitCard.svelte';
	import { pageTitle } from '$lib/config/site';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canonical = $derived(new URL(resolve('/kits'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle('Kits')}</title>
	<meta
		name="description"
		content="Curated CS2 skin combinations built around colour and visual direction, with every skin linked to its price comparison."
	/>
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-8">
	<header class="max-w-2xl space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Kits</h1>
		<p class="text-sm text-muted-foreground">
			Curated CS2 skin combinations built around colour and visual direction. Open a kit to see what
			is in it and compare each skin's price.
		</p>
	</header>

	{#if data.kits.length === 0}
		<p
			class="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground"
		>
			No kits yet.
		</p>
	{:else}
		<!-- Editorial order: the dataset decides, so there is nothing to sort by. -->
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.kits as kit (kit.slug)}
				<KitCard {kit} />
			{/each}
		</div>
	{/if}
</PageContainer>
