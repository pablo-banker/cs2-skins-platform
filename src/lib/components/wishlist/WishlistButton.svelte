<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		addToWishlist,
		isInWishlist,
		removeFromWishlist,
		readWishlist,
		wishlistItemKey
	} from '$lib/features/wishlist';
	import { MAX_WISHLIST_ITEMS } from '$lib/schemas/wishlist';
	import type { SkinSelection } from '$lib/schemas/skin-detail';

	/**
	 * Saves the exact variant on screen, or removes it.
	 *
	 * A **toggle**, not an add button that goes dead. Someone who saved
	 * something by mistake should be able to undo it where they did it, and a
	 * disabled "In wishlist" button answers a question nobody asked.
	 *
	 * Membership is exact-variant-specific. Saving Field-Tested and then
	 * switching the page to Minimal Wear correctly shows "Add to wishlist"
	 * again — they are two different purchases at two different prices.
	 */
	let {
		skinSlug,
		variant,
		/**
		 * The current lowest ask, when one is known.
		 *
		 * Snapshotted at the moment of saving so the wishlist can answer "has
		 * this got cheaper since?". Absent is fine — a skin nobody is currently
		 * listing must still be savable, it just gets no baseline.
		 */
		currentPrice
	}: {
		skinSlug: string;
		variant: SkinSelection;
		currentPrice?: { amountMinor: number; currency: string };
	} = $props();

	/**
	 * Starts unsaved on the server and on first paint, then corrects itself.
	 *
	 * `localStorage` does not exist during SSR, so any other initial value
	 * would be a guess that hydration then contradicts. Unsaved is the neutral
	 * state: the control is never wrong for long, and never flashes "saved" for
	 * something that is not.
	 */
	let saved = $state(false);
	let hydrated = $state(false);
	/** Set when a save was refused because the list is already full. */
	let full = $state(false);

	const identity = $derived({ skinSlug, variant });

	$effect(() => {
		// Re-runs when the variant changes, which is the whole point: the
		// selector swaps exteriors without a navigation.
		saved = isInWishlist(readWishlist(), identity);
		hydrated = true;
		full = false;
	});

	function toggle() {
		if (saved) {
			removeFromWishlist(identity);
			saved = false;
			full = false;

			return;
		}

		const result = addToWishlist({
			skinSlug,
			variant,
			addedAt: new Date().toISOString(),
			...(currentPrice
				? { addedPriceMinor: currentPrice.amountMinor, currency: currentPrice.currency }
				: {})
		});

		// A full list refuses the save and deletes nothing. Saying so is the
		// whole response — the visitor removes something themselves.
		full = result.status === 'full';
		saved = result.status !== 'full';
	}
</script>

<div class="space-y-1.5">
	<Button
		type="button"
		variant="outline"
		size="sm"
		onclick={toggle}
		aria-pressed={hydrated ? saved : undefined}
		data-wishlist-key={wishlistItemKey(identity)}
	>
		<HeartIcon class="size-4 {saved ? 'fill-current text-primary' : ''}" aria-hidden="true" />
		<!-- The label carries the state, so it does not depend on the icon fill. -->
		{saved ? 'In wishlist' : 'Add to wishlist'}
	</Button>

	{#if full}
		<!--
			Announced, because the button itself does not change — the visitor
			pressed save and nothing appeared to happen.
		-->
		<p class="text-xs text-warning" role="status">
			Your wishlist is full. You can save up to {MAX_WISHLIST_ITEMS} skins — remove one to make room.
		</p>
	{/if}
</div>
