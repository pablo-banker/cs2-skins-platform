<script lang="ts">
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import WishlistItemCard from '$lib/components/wishlist/WishlistItem.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		clearWishlist,
		newestFirst,
		readWishlist,
		removeFromWishlist,
		wishlistItemKey
	} from '$lib/features/wishlist';
	import { pageTitle } from '$lib/config/site';
	import type { WishlistItem } from '$lib/schemas/wishlist';
	import type { ResolvedWishlistItem, WishlistResolution } from '$lib/types/wishlist';

	/**
	 * The wishlist someone saved on this device.
	 *
	 * The list itself is `localStorage`, so the page restores rather than
	 * loads: the server renders a frame, the browser reads storage, and one
	 * request turns saved identities into current catalog data and prices.
	 *
	 * The **restoring** state exists so the empty state never flashes. "Your
	 * wishlist is empty" appearing for 200ms in front of someone who has forty
	 * saved skins is a lie the page tells about itself.
	 */
	type Phase = 'restoring' | 'ready' | 'failed';

	let phase = $state<Phase>('restoring');

	/** The local truth: identity plus the add-time snapshot. */
	let saved = $state<WishlistItem[]>([]);
	/** What the server said about them. */
	let resolved = $state<ResolvedWishlistItem[]>([]);
	let prunedCount = $state(0);
	let confirmingClear = $state(false);

	const baselines = $derived(new Map(saved.map((item) => [wishlistItemKey(item), item])));

	// Newest first, and the server's order is not authoritative — the browser
	// knows when each was saved.
	const cards = $derived(
		newestFirst(saved)
			.map((item) => resolved.find((entry) => entry.key === wishlistItemKey(item)))
			.filter((entry): entry is ResolvedWishlistItem => entry !== undefined)
	);

	async function restore() {
		const items = readWishlist();

		saved = items;

		if (items.length === 0) {
			phase = 'ready';

			return;
		}

		try {
			const response = await fetch('/api/wishlist/resolve', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				// Identities only. The snapshot and the timestamp stay here.
				body: JSON.stringify({
					items: items.map((item) => ({ skinSlug: item.skinSlug, variant: item.variant }))
				})
			});

			if (!response.ok) throw new Error('resolve-failed');

			const body = (await response.json()) as WishlistResolution;

			resolved = body.items;

			/**
			 * Saved entries the catalog no longer has are pruned — but only
			 * once the answer arrived. Pruning on a failed request would
			 * delete somebody's wishlist because the network blinked.
			 */
			if (body.rejected.length > 0) {
				prunedCount = body.rejected.length;

				for (const entry of body.rejected) {
					saved = removeFromWishlist({
						skinSlug: entry.skinSlug,
						variant: saved.find((item) => wishlistItemKey(item) === entry.key)?.variant ?? {}
					});
				}
			}

			phase = 'ready';
		} catch {
			phase = 'failed';
		}
	}

	$effect(() => {
		void restore();
	});

	function remove(item: ResolvedWishlistItem) {
		const local = saved.find((entry) => wishlistItemKey(entry) === item.key);
		if (!local) return;

		saved = removeFromWishlist(local);
		// Filtered locally: the other items' prices are still the prices we
		// were just given, and re-pricing them because one card left would be
		// a request bought for nothing.
		resolved = resolved.filter((entry) => entry.key !== item.key);
	}

	function clearAll() {
		clearWishlist();
		saved = [];
		resolved = [];
		prunedCount = 0;
		confirmingClear = false;
	}

	// `new URL`, not concatenation: `resolve()` returns a path relative
	// to the current URL, so `origin + resolve(…)` yields `host./route`.
	const canonical = $derived(new URL(resolve('/wishlist'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle('Wishlist')}</title>
	<meta
		name="description"
		content="Keep an eye on CS2 skins you might buy, and see how their current marketplace prices compare with when you saved them."
	/>
	<!--
		No item names and no prices in the metadata: a wishlist lives in one
		browser, and the server rendering this page has never seen it.

		And `noindex` for the same reason — everything a crawler would see here
		is the empty frame, identical for everybody. There is nothing to rank
		and nothing worth ranking it against. It is left out of the sitemap too.
	-->
	<meta name="robots" content="noindex, follow" />
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-8">
	<header class="max-w-2xl space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Wishlist</h1>
		<p class="text-sm text-muted-foreground">
			Skins you might buy, with their current lowest marketplace prices.
			<span class="text-subtle-foreground">Saved on this device.</span>
		</p>
	</header>

	<!--
		One live region for the whole lifecycle, so a screen reader hears
		"Loading", then the count, rather than nothing at all.
	-->
	<div aria-live="polite" class="space-y-6">
		{#if phase === 'restoring'}
			<p class="text-sm text-muted-foreground">Loading your wishlist…</p>
		{:else if phase === 'failed'}
			<div class="space-y-3 rounded-lg border border-border bg-surface p-6">
				<p class="text-sm font-medium text-foreground">Your wishlist could not be loaded</p>
				<p class="text-sm text-muted-foreground">
					Your saved skins are safe on this device. Try again in a moment.
				</p>
			</div>
		{:else if cards.length === 0}
			<!--
				Shown here too: if every saved skin was pruned, "your wishlist is
				empty" on its own would leave someone wondering where they went.
			-->
			{#if prunedCount > 0}
				<p
					class="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
				>
					{prunedCount === 1
						? 'One saved skin is no longer available and was removed.'
						: `${prunedCount} saved skins are no longer available and were removed.`}
				</p>
			{/if}

			<div
				class="max-w-xl space-y-4 rounded-lg border border-dashed border-border bg-surface/50 p-8"
			>
				<p class="text-sm font-medium text-foreground">Your wishlist is empty</p>
				<p class="text-sm text-muted-foreground">
					Save skins from their detail pages to keep an eye on current prices.
				</p>
				<Button href={resolve('/explore')}>Explore skins</Button>
			</div>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-muted-foreground">
					{cards.length}
					{cards.length === 1 ? 'saved skin' : 'saved skins'}
				</p>

				<Button type="button" variant="ghost" size="sm" onclick={() => (confirmingClear = true)}>
					Clear wishlist
				</Button>
			</div>

			{#if prunedCount > 0}
				<p
					class="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
				>
					{prunedCount === 1
						? 'One saved skin is no longer available and was removed.'
						: `${prunedCount} saved skins are no longer available and were removed.`}
				</p>
			{/if}

			<!-- Named so it is distinguishable from the header and footer navs. -->
			<ul aria-label="Saved skins" class="grid gap-3 lg:grid-cols-2">
				{#each cards as item (item.key)}
					<WishlistItemCard
						{item}
						baseline={baselines.get(item.key)?.addedPriceMinor && baselines.get(item.key)?.currency
							? {
									amountMinor: baselines.get(item.key)!.addedPriceMinor!,
									currency: baselines.get(item.key)!.currency!
								}
							: undefined}
						addedAt={baselines.get(item.key)?.addedAt}
						onremove={() => remove(item)}
					/>
				{/each}
			</ul>
		{/if}
	</div>
</PageContainer>

<Dialog.Root bind:open={confirmingClear}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Clear your wishlist?</Dialog.Title>
			<Dialog.Description>
				This removes all {cards.length} saved {cards.length === 1 ? 'skin' : 'skins'} from this device.
				It cannot be undone.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (confirmingClear = false)}>
				Keep them
			</Button>
			<Button type="button" onclick={clearAll}>Clear wishlist</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
