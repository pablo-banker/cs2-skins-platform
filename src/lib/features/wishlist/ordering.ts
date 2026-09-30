/**
 * The order a wishlist reads in.
 *
 * Newest first, and no sort controls. Someone opening this page is checking on
 * what they were most recently interested in; "biggest drop" and "cheapest"
 * are portfolio questions, and a sort by price would quietly reframe a list of
 * wants as a list of investments.
 */
import type { WishlistItem } from '$lib/schemas/wishlist';

/**
 * Newest first, with the canonical slug breaking ties.
 *
 * The tie-break matters more than it looks: two items saved in the same
 * millisecond must not swap places between renders, and `addedAt` has
 * millisecond resolution at best.
 */
export function newestFirst(items: readonly WishlistItem[]): WishlistItem[] {
	return [...items].sort(
		(a, b) => b.addedAt.localeCompare(a.addedAt) || a.skinSlug.localeCompare(b.skinSlug)
	);
}
