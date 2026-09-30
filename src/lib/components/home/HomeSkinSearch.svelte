<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SearchResultItem from '$lib/components/search/SearchResultItem.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { SEARCH_MIN_QUERY_LENGTH } from '$lib/schemas/search';
	import { createSkinSearch } from '$lib/features/skins/skin-search.svelte';
	import { rememberRecentSkin } from '$lib/features/skins/recent-skins';

	/**
	 * Find a specific skin, from the front door.
	 *
	 * Someone who arrives already knowing what they want should not have to
	 * discover a keyboard shortcut first. This is the header search's twin, not
	 * a second implementation: the debounce, the endpoint, the threshold and the
	 * ranking all come from `createSkinSearch`. What differs is presentation —
	 * an always-visible field with results beneath it, rather than a dialog.
	 *
	 * **No prices while typing.** Search is a navigator; comparison lives on the
	 * skin page.
	 */
	let input = $state('');
	let focused = $state(false);

	const search = createSkinSearch(() => input);

	// Results are a panel under the field, so they appear only while the field
	// is in use — otherwise they would sit under the hero permanently.
	const showResults = $derived(focused && search.searchable);

	const exploreHref = $derived(
		search.normalized
			? `${resolve('/explore')}?q=${encodeURIComponent(search.normalized)}`
			: resolve('/explore')
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<div class="relative">
	<form
		role="search"
		onsubmit={(event) => {
			event.preventDefault();
			// Enter goes to the full result set rather than guessing which one
			// was meant.
			if (search.searchable) goto(exploreHref);
		}}
	>
		<!--
			Distinct from the header trigger's "Search skins": two controls with
			the same accessible name on one page is a genuine ambiguity for
			anyone navigating by name.
		-->
		<label for="home-skin-search" class="sr-only">Search for a skin</label>

		<div
			class="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3
				focus-within:border-muted-foreground/40 sm:px-5 sm:py-4"
		>
			<SearchIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<input
				id="home-skin-search"
				type="search"
				bind:value={input}
				onfocus={() => (focused = true)}
				placeholder="Search skins, e.g. AK-47 Redline"
				autocomplete="off"
				aria-describedby="home-skin-search-hint"
				class="min-w-0 flex-1 bg-transparent text-base text-foreground
					placeholder:text-subtle-foreground focus:outline-none sm:text-lg"
			/>
		</div>

		<p id="home-skin-search-hint" class="sr-only">
			Type at least {SEARCH_MIN_QUERY_LENGTH} characters. Results appear below.
		</p>
	</form>

	{#if showResults}
		<div
			class="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-border
				bg-surface-elevated shadow-lg"
		>
			{#if search.loading}
				<div class="space-y-1 p-2" aria-hidden="true">
					{#each Array.from({ length: 3 }, (_, index) => index) as row (row)}
						<div class="flex items-center gap-3 px-2 py-2">
							<Skeleton class="aspect-[4/3] w-14 shrink-0 rounded-sm" />
							<div class="flex-1 space-y-1.5">
								<Skeleton class="h-3 w-12" />
								<Skeleton class="h-4 w-32" />
							</div>
						</div>
					{/each}
				</div>
				<span class="sr-only" role="status">Searching</span>
			{:else if search.isError}
				<div class="px-4 py-6 text-center">
					<p class="text-sm text-foreground">Search is temporarily unavailable.</p>
					<button
						type="button"
						onclick={() => search.retry()}
						class="mt-2 rounded-sm text-sm text-muted-foreground underline underline-offset-4
							hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						Try again
					</button>
				</div>
			{:else if search.items.length === 0}
				<p class="px-4 py-6 text-center text-sm text-muted-foreground">
					No skins found for “{input.trim()}”.
				</p>
			{:else}
				<ul class="p-1" aria-label="Search results">
					{#each search.items as item (item.slug)}
						<li>
							<a
								href={resolve('/skins/[slug]', { slug: item.slug })}
								onclick={() => rememberRecentSkin(item)}
								class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left
									hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							>
								<SearchResultItem
									weapon={item.weapon}
									name={item.name}
									imageUrl={item.imageUrl}
									rarityName={item.rarity?.name}
									wear={item.representativeWear}
								/>
							</a>
						</li>
					{/each}
				</ul>

				<div class="border-t border-border p-1">
					<a
						href={exploreHref}
						class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground
							hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<SearchIcon class="size-4" aria-hidden="true" />
						View all results for “{input.trim()}”
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>
<!-- eslint-enable svelte/no-navigation-without-resolve -->

<svelte:window
	onclick={(event) => {
		// Dismiss when attention moves elsewhere, so the panel does not hang
		// over the page after someone has stopped searching.
		const target = event.target as HTMLElement | null;
		if (!target?.closest('#home-skin-search, [aria-label="Search results"]')) focused = false;
	}}
/>
