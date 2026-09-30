<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Command from '$lib/components/ui/command';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SearchResultItem from './SearchResultItem.svelte';
	import GlobalSearchTrigger from './GlobalSearchTrigger.svelte';
	import { isSearchable, SEARCH_MIN_QUERY_LENGTH } from '$lib/schemas/search';
	import { createSkinSearch } from '$lib/features/skins/skin-search.svelte';
	import { readRecentSkins, rememberRecentSkin } from '$lib/features/skins/recent-skins';
	import type { RecentSkin } from '$lib/features/skins/recent-skins';

	/**
	 * Global search: find a skin from anywhere and open it.
	 *
	 * Deliberately not a second Explore. Explore is URL-driven SSR for faceted
	 * discovery; this is interactive client state for "I know roughly what I
	 * want". TanStack Query fits here — per-query caching, deduplication and
	 * cancellation are exactly what a search box needs, and none of them are
	 * what a shareable filter URL needs.
	 *
	 * The browser never talks to CS2Cap: it calls our own endpoint, which
	 * answers from the cached catalog index.
	 */
	let open = $state(false);
	let input = $state('');
	let recents = $state<RecentSkin[]>([]);

	/**
	 * The debounce and the query come from the shared helper, so the header
	 * and the homepage cannot disagree about when a request goes out. Only the
	 * presentation below is this component's own.
	 */
	const search = createSkinSearch(
		() => input,
		() => open
	);

	const loading = $derived(search.loading);
	const items = $derived(search.items);

	let triggerRef = $state<HTMLElement | null>(null);
	let navigated = false;

	function openSearch() {
		recents = readRecentSkins();
		open = true;
	}

	/**
	 * Return focus to the trigger on close.
	 *
	 * The dialog is opened programmatically — by the header button or by the
	 * keyboard shortcut — so the primitive has no trigger element to hand
	 * focus back to, and without this a keyboard user is dropped at the top of
	 * the document. Skipped after a selection, where focus belongs to the page
	 * that was just opened.
	 *
	 * `wasOpen` is what makes this a *close* rather than a mount. The effect
	 * runs once on render, when `open` is already false, and without the guard
	 * it focused the trigger on every page load — which put focus in the
	 * middle of the header before the visitor had touched anything, and meant
	 * the first Tab landed past the skip link instead of on it. Plain `let`,
	 * not `$state`: it records what happened, and must not re-trigger the
	 * effect that writes it.
	 */
	let wasOpen = false;

	$effect(() => {
		if (open) {
			wasOpen = true;
			return;
		}

		if (!wasOpen) return;
		wasOpen = false;

		if (navigated) {
			navigated = false;
			return;
		}

		triggerRef?.focus();
	});

	/** Cmd/Ctrl+K from anywhere, without stealing other shortcuts. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'k' && event.key !== 'K') return;
		if (!(event.metaKey || event.ctrlKey)) return;
		// Cmd+Shift+K and Ctrl+Alt+K belong to other things.
		if (event.altKey || event.shiftKey) return;

		event.preventDefault();

		if (open) open = false;
		else openSearch();
	}

	async function select(skin: RecentSkin) {
		recents = rememberRecentSkin(skin);
		navigated = true;
		open = false;
		// A fresh dialog next time, rather than yesterday's half-typed query.
		input = '';

		await goto(resolve('/skins/[slug]', { slug: skin.slug }));
	}

	const exploreHref = $derived(`${resolve('/explore')}?q=${encodeURIComponent(search.normalized)}`);
</script>

<svelte:window onkeydown={onKeydown} />

<GlobalSearchTrigger bind:ref={triggerRef} onopen={openSearch} />

<Command.Dialog
	bind:open
	title="Search skins"
	description="Find a skin by weapon or name"
	shouldFilter={false}
	class="sm:max-w-2xl"
>
	<Command.Input placeholder="Search skins, e.g. Redline" bind:value={input} />

	<Command.List class="max-h-[60vh]">
		{#if !isSearchable(input)}
			{#if recents.length > 0}
				<Command.Group heading="Recent">
					{#each recents as recent (recent.slug)}
						<Command.Item value={recent.slug} onSelect={() => select(recent)} class="gap-3 py-2">
							<SearchResultItem
								weapon={recent.weapon}
								name={recent.name}
								imageUrl={recent.imageUrl}
							/>
						</Command.Item>
					{/each}
				</Command.Group>
			{:else}
				<p class="px-3 py-6 text-center text-sm text-muted-foreground">
					Search by weapon or skin name.
				</p>
			{/if}
		{:else if loading}
			<div class="space-y-1 p-1" aria-hidden="true">
				{#each Array.from({ length: 4 }, (_, i) => i) as row (row)}
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
			<div class="px-3 py-6 text-center">
				<p class="text-sm text-foreground">Search is temporarily unavailable.</p>
				<button
					type="button"
					onclick={() => search.retry()}
					class="mt-2 rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					Try again
				</button>
			</div>
		{:else if items.length === 0}
			<div class="px-3 py-6 text-center">
				<p class="text-sm text-muted-foreground">No skins found for “{input.trim()}”.</p>
			</div>
		{:else}
			<Command.Group heading="Skins">
				{#each items as item (item.slug)}
					<Command.Item value={item.slug} onSelect={() => select(item)} class="gap-3 py-2">
						<SearchResultItem
							weapon={item.weapon}
							name={item.name}
							imageUrl={item.imageUrl}
							rarityName={item.rarity?.name}
							wear={item.representativeWear}
						/>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}

		{#if isSearchable(input) && !loading && items.length > 0}
			<Command.Separator />
			<Command.Group>
				<Command.LinkItem
					href={exploreHref}
					value="__view-all__"
					onSelect={() => (open = false)}
					class="gap-2 py-2"
				>
					<SearchIcon class="size-4" aria-hidden="true" />
					View all results for “{input.trim()}”
				</Command.LinkItem>
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>

<span class="sr-only"
	>Press Control or Command plus K to search. Minimum {SEARCH_MIN_QUERY_LENGTH} characters.</span
>
