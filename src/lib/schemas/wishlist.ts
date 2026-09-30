/**
 * What a wishlist looks like when it leaves the page.
 *
 * Like a saved loadout, an entry stores **canonical application identity** — a
 * route slug and a variant in our own vocabulary — and never a catalog item id
 * or a market hash name. Those tie a save to someone else's numbering.
 *
 * Unlike a saved loadout, an entry *may* store a price: the one observed when
 * it was added. That is the deliberate difference, and it is safe for one
 * reason — it is a **historical snapshot**, not a cached current price. A
 * builder total restored from storage would be a stale number pretending to be
 * live; "R$ 153,00 when I saved this" stays true forever. It is labelled as
 * such everywhere it is shown and is never used as current market data.
 */
import { z } from 'zod';
import { SKIN_EDITIONS } from './skin-detail';

/**
 * The one key the wishlist owns in `localStorage`.
 *
 * Namespaced and versioned in the key itself, so a future format can live
 * beside this one rather than having to interpret it. **Separate from the
 * builder's key**: two features with different lifetimes and different formats
 * sharing one record is how a change to one silently breaks the other.
 */
export const WISHLIST_STORAGE_KEY = 'cs2-skins:wishlist:v1';

/** The only persisted schema version this build understands. */
export const PERSISTED_WISHLIST_VERSION = 1;

/**
 * How many skins someone may keep an eye on.
 *
 * A wishlist is "things I might buy", not an inventory, and fifty is already
 * more than anyone reviews in one sitting. The number bounds three things at
 * once: what a browser stores, what the endpoint will accept, and how many
 * items one page load can ask the market about.
 */
export const MAX_WISHLIST_ITEMS = 50;

const skinSlug = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a skin slug');

/** The exact variant, in the same vocabulary the skin page's URL uses. */
export const wishlistVariantSchema = z
	.object({
		wear: z.string().trim().min(1).max(64).optional(),
		edition: z.enum(SKIN_EDITIONS).optional(),
		phase: z.string().trim().min(1).max(64).optional()
	})
	.strict();

/**
 * One saved skin.
 *
 * `addedPriceMinor` is optional because a skin with no current quote must
 * still be savable — refusing to save something because the market is quiet
 * would be the wrong failure. When present it is a positive integer in minor
 * units with a currency beside it; a price without a currency is not a price,
 * so the two travel together or not at all.
 */
export const wishlistItemSchema = z
	.object({
		skinSlug,
		variant: wishlistVariantSchema.default({}),
		/** ISO 8601. Wishlist metadata, not market data. */
		addedAt: z.iso.datetime(),
		/** Lowest ask observed when this was saved. Never rewritten. */
		addedPriceMinor: z.number().int().positive().optional(),
		currency: z.string().trim().length(3).toUpperCase().optional()
	})
	.strict()
	.refine(
		(item) => (item.addedPriceMinor === undefined) === (item.currency === undefined),
		'A baseline price needs a currency, and a currency needs a price'
	);

export type WishlistItem = z.infer<typeof wishlistItemSchema>;

/**
 * A saved wishlist.
 *
 * `version` is checked rather than assumed: a payload written by a future
 * build is discarded, not reinterpreted as v1. Reading is otherwise strict —
 * an unknown field means the payload is not what we think it is, and an
 * `itemId` or a `providerId` appearing here would mean something upstream had
 * leaked into storage.
 */
export const persistedWishlistSchema = z
	.object({
		version: z.literal(PERSISTED_WISHLIST_VERSION),
		items: z.array(wishlistItemSchema).max(MAX_WISHLIST_ITEMS)
	})
	.strict();

export type PersistedWishlist = z.infer<typeof persistedWishlistSchema>;

/**
 * One identity the resolve endpoint accepts.
 *
 * Deliberately **not** `wishlistItemSchema`. The server has no use for when
 * something was saved or what it cost then — those are the browser's business,
 * and a payload that carried them would invite the server to start trusting
 * them. It gets what it needs to look a variant up, and nothing else.
 */
export const wishlistIdentitySchema = z
	.object({
		skinSlug,
		variant: wishlistVariantSchema.default({})
	})
	.strict();

export type WishlistIdentity = z.infer<typeof wishlistIdentitySchema>;

/**
 * A resolve request.
 *
 * Tolerant in the same way builder restoration is: an empty list parses, and
 * a saved item that no longer exists is the resolver's problem to report
 * rather than a reason to reject the whole request. Duplicates *are* rejected,
 * because the browser deduplicates before it ever writes — a duplicate here
 * means the payload was not written by this product.
 */
export const wishlistResolveRequestSchema = z
	.object({
		items: z
			.array(wishlistIdentitySchema)
			.max(MAX_WISHLIST_ITEMS)
			.refine(
				(items) =>
					new Set(
						items.map((item) =>
							[item.skinSlug, item.variant.wear, item.variant.edition, item.variant.phase].join('|')
						)
					).size === items.length,
				'The same variant cannot appear twice'
			)
	})
	.strict();

export type WishlistResolveRequest = z.infer<typeof wishlistResolveRequestSchema>;
