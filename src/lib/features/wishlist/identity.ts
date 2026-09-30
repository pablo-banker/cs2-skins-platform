/**
 * What makes two wishlist entries the same entry.
 *
 * **An exact variant, not a skin.** Someone watching a Field-Tested Redline
 * and a Minimal Wear Redline is watching two different purchases at two
 * different prices, and collapsing them would lose one of the two baselines
 * they are comparing against.
 *
 * One helper, used for deduplication, for membership on the skin page, for
 * removal, and for joining the server's answer back onto local state. Four
 * places building the same string slightly differently is exactly how a
 * "remove" button ends up removing nothing.
 */
import type { SkinSelection } from '$lib/schemas/skin-detail';

/** Anything that names a saved skin. */
export type WishlistIdentityLike = {
	skinSlug: string;
	variant: SkinSelection;
};

/**
 * The canonical key for one saved variant.
 *
 * `normal` and "unspecified" collapse to the same key on purpose: an edition
 * the visitor never chose and the plain edition are the same item, and a link
 * that happens to spell it out must not create a second entry.
 */
export function wishlistItemKey(item: WishlistIdentityLike): string {
	const { wear, edition, phase } = item.variant;

	return [
		item.skinSlug,
		wear ?? '',
		edition && edition !== 'normal' ? edition : '',
		phase ?? ''
	].join('|');
}

/** Whether this exact variant is already saved. */
export function isInWishlist(
	items: readonly WishlistIdentityLike[],
	item: WishlistIdentityLike
): boolean {
	const key = wishlistItemKey(item);

	return items.some((entry) => wishlistItemKey(entry) === key);
}
