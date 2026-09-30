/**
 * The wishlist's public surface.
 *
 * A barrel here earns its place: components need identity, persistence and
 * price movement together, and four import lines per component would be
 * noise. It re-exports, it does not define.
 */
export { wishlistItemKey, isInWishlist, type WishlistIdentityLike } from './identity';
export { newestFirst } from './ordering';
export { priceChangeSinceAdded, type Money, type PriceChange } from './price-change';
export {
	addToWishlist,
	type WishlistAddResult,
	clearWishlist,
	readWishlist,
	removeFromWishlist,
	writeWishlist
} from './persistence';
