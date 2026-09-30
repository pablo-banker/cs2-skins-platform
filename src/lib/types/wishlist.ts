/**
 * What the wishlist resolve endpoint hands back.
 *
 * A narrow presentation contract, not a market dump: one current lowest ask
 * per item, not every marketplace. Full comparison is the skin page's job, and
 * shipping complete quote sets for fifty items would be a payload nobody
 * renders.
 */
import type { SkinSelection } from '$lib/schemas/skin-detail';
import type { SkinRarity } from './skin';

/**
 * Why a saved item could no longer be shown.
 *
 * Kept apart because they mean different things to a visitor: a skin that left
 * the catalog is gone, and an exterior that no longer exists is a promise we
 * cannot keep. Neither is ever substituted with something close.
 */
export type WishlistRejectionReason = 'unknown-skin' | 'invalid-variant';

export type RejectedWishlistItem = {
	/** The canonical key, so the browser can prune exactly this entry. */
	key: string;
	skinSlug: string;
	reason: WishlistRejectionReason;
};

/** Whether the market had an answer for this item, and which kind. */
export type WishlistPriceState = 'priced' | 'unpriced' | 'error';

export type ResolvedWishlistItem = {
	/** Canonical identity, matching what the browser stored. */
	key: string;
	skinSlug: string;
	weapon: string;
	/** Finish name. Empty for a vanilla knife, where the weapon is the identity. */
	name: string;
	fullName: string;
	imageUrl?: string;
	rarity?: SkinRarity;
	/** The exact variant that was saved, confirmed against the catalog. */
	variant: SkinSelection;
	/**
	 * `priced` with an amount, `unpriced` when nothing is currently listed, and
	 * `error` when the market could not be asked. A visitor deserves to know
	 * which of those happened.
	 */
	priceState: WishlistPriceState;
	currentPriceMinor?: number;
	currency?: string;
	providerId?: string;
	/** Absent when the provider directory could not be loaded. */
	providerName?: string;
};

export type WishlistResolution = {
	items: ResolvedWishlistItem[];
	/** Saved entries the catalog no longer has. The browser prunes these. */
	rejected: RejectedWishlistItem[];
};
