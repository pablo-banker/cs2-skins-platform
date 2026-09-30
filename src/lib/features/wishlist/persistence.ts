/**
 * Keeping the wishlist on this device.
 *
 * **A convenience, not a feature the product depends on.** `localStorage` can
 * be absent, disabled, full, or hold something a previous build wrote — so
 * every operation here is total. Nothing throws, nothing propagates, and a
 * browser that refuses to store anything still gets a working page for the
 * session.
 *
 * Safe to import during SSR: `localStorage` is touched inside functions, never
 * at module scope, so loading this on the server does nothing at all.
 *
 * The same shape as the builder's persistence module, deliberately — but a
 * separate key and a separate format, because the two have different
 * lifetimes and one is allowed to store a price.
 */
import {
	MAX_WISHLIST_ITEMS,
	persistedWishlistSchema,
	PERSISTED_WISHLIST_VERSION,
	WISHLIST_STORAGE_KEY,
	type WishlistItem
} from '$lib/schemas/wishlist';
import { wishlistItemKey, type WishlistIdentityLike } from './identity';
import { newestFirst } from './ordering';

/**
 * The store, if there is one.
 *
 * Reading `localStorage` can itself throw — Safari does exactly that with site
 * data blocked — so even getting hold of it is guarded.
 */
function storage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

/**
 * What was saved on this device, if anything usable was.
 *
 * Anything unreadable — absent, corrupt, a version we do not understand, a
 * shape that fails validation — comes back as an empty list. Deliberately
 * quiet: there is no recovery a visitor could perform, and the page simply
 * shows an empty wishlist.
 */
export function readWishlist(): WishlistItem[] {
	const store = storage();
	if (!store) return [];

	let raw: string | null;

	try {
		raw = store.getItem(WISHLIST_STORAGE_KEY);
	} catch {
		return [];
	}

	if (!raw) return [];

	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	const result = persistedWishlistSchema.safeParse(parsed);

	return result.success ? newestFirst(result.data.items) : [];
}

/**
 * Saves the list, or removes the key when there is nothing to save.
 *
 * An empty wishlist is stored as **no key** rather than as an empty list. The
 * two are indistinguishable when read back, and leaving a record behind for a
 * list someone emptied is tidier in the code and untidier on their machine.
 *
 * Returns whether it worked, so a caller that cares can tell.
 */
export function writeWishlist(items: readonly WishlistItem[]): boolean {
	const store = storage();
	if (!store) return false;

	try {
		if (items.length === 0) {
			store.removeItem(WISHLIST_STORAGE_KEY);
			return true;
		}

		store.setItem(
			WISHLIST_STORAGE_KEY,
			JSON.stringify({ version: PERSISTED_WISHLIST_VERSION, items })
		);

		return true;
	} catch {
		// Quota exceeded, private mode, storage disabled mid-session. The page
		// keeps working; only the save is lost.
		return false;
	}
}

/**
 * What happened when something was saved.
 *
 * `items` is always the list as it now stands, so a caller can render from it
 * whatever the outcome.
 */
export type WishlistAddResult = {
	status: 'added' | 'already-saved' | 'full';
	items: WishlistItem[];
};

/**
 * Adds one exact variant, and says what happened.
 *
 * **Idempotent.** Saving something already saved changes nothing — in
 * particular it does not refresh the baseline price, because that would
 * silently reset the comparison the visitor is keeping. Re-establishing a
 * baseline is done by removing and adding again, which is a thing someone
 * chose to do.
 *
 * **At capacity the save is refused, and nothing is deleted.** Every entry
 * already there is something a person deliberately saved; dropping the oldest
 * to make room would quietly throw away one explicit choice to honour another.
 * The visitor is told the list is full and can remove something themselves.
 */
export function addToWishlist(item: WishlistItem): WishlistAddResult {
	const current = readWishlist();
	const key = wishlistItemKey(item);

	if (current.some((entry) => wishlistItemKey(entry) === key)) {
		return { status: 'already-saved', items: current };
	}

	// Checked before anything is written, so a refused save leaves storage
	// exactly as it was.
	if (current.length >= MAX_WISHLIST_ITEMS) return { status: 'full', items: current };

	const next = newestFirst([item, ...current]);

	writeWishlist(next);

	return { status: 'added', items: next };
}

/** Removes one exact variant, and returns the list as it now stands. */
export function removeFromWishlist(item: WishlistIdentityLike): WishlistItem[] {
	const key = wishlistItemKey(item);
	const next = readWishlist().filter((entry) => wishlistItemKey(entry) !== key);

	writeWishlist(next);

	return next;
}

/** Empties the wishlist and removes the key entirely. */
export function clearWishlist(): void {
	writeWishlist([]);
}
