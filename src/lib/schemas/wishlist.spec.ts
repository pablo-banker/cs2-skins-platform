import { describe, expect, it } from 'vitest';
import {
	MAX_WISHLIST_ITEMS,
	persistedWishlistSchema,
	wishlistItemSchema,
	wishlistResolveRequestSchema,
	WISHLIST_STORAGE_KEY
} from './wishlist';

const ADDED_AT = '2026-09-29T10:00:00.000Z';

function item(overrides: Record<string, unknown> = {}) {
	return {
		skinSlug: 'ak-47-redline',
		variant: { wear: 'Field-Tested' },
		addedAt: ADDED_AT,
		...overrides
	};
}

describe('the storage key', () => {
	it('is namespaced, versioned, and not the builder’s', () => {
		expect(WISHLIST_STORAGE_KEY).toBe('cs2-skins:wishlist:v1');
		expect(WISHLIST_STORAGE_KEY).not.toBe('cs2-skins:builder:v1');
	});
});

describe('one saved item', () => {
	it('accepts identity and a timestamp, with no price', () => {
		const parsed = wishlistItemSchema.safeParse(item());

		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.addedPriceMinor).toBeUndefined();
	});

	it('accepts a baseline price with its currency', () => {
		const parsed = wishlistItemSchema.safeParse(item({ addedPriceMinor: 15_300, currency: 'BRL' }));

		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.addedPriceMinor).toBe(15_300);
	});

	it('defaults an absent variant to the plain one', () => {
		const parsed = wishlistItemSchema.safeParse({ skinSlug: 'bayonet', addedAt: ADDED_AT });

		expect(parsed.success && parsed.data.variant).toEqual({});
	});

	it('accepts every edition in the shared vocabulary', () => {
		for (const edition of ['normal', 'stattrak', 'souvenir']) {
			expect(wishlistItemSchema.safeParse(item({ variant: { edition } })).success, edition).toBe(
				true
			);
		}
	});

	it('refuses an edition outside it', () => {
		expect(wishlistItemSchema.safeParse(item({ variant: { edition: 'gold' } })).success).toBe(
			false
		);
	});

	it('refuses a price that is not a positive integer', () => {
		for (const addedPriceMinor of [0, -1, 1.5, '15300', null]) {
			expect(
				wishlistItemSchema.safeParse(item({ addedPriceMinor, currency: 'BRL' })).success,
				String(addedPriceMinor)
			).toBe(false);
		}
	});

	it('refuses half a baseline', () => {
		// A price without a currency is not a price, and a currency alone
		// describes nothing.
		expect(wishlistItemSchema.safeParse(item({ addedPriceMinor: 15_300 })).success).toBe(false);
		expect(wishlistItemSchema.safeParse(item({ currency: 'BRL' })).success).toBe(false);
	});

	it('refuses a malformed timestamp', () => {
		for (const addedAt of ['yesterday', '2026-09-29', '', 1_759_000_000_000]) {
			expect(wishlistItemSchema.safeParse(item({ addedAt })).success, String(addedAt)).toBe(false);
		}
	});

	it('refuses a slug that is not a slug', () => {
		for (const skinSlug of ['AK-47 Redline', 'ak_47', '', '../etc']) {
			expect(wishlistItemSchema.safeParse(item({ skinSlug })).success, skinSlug).toBe(false);
		}
	});

	it('refuses anything upstream that leaked into storage', () => {
		// The whole reason this is strict: an item id or a provider appearing
		// here would mean the browser had started saving market data.
		for (const extra of [
			{ itemId: 12_633 },
			{ marketHashName: 'AK-47 | Redline (Field-Tested)' },
			{ providerId: 'csfloat' },
			{ currentPriceMinor: 13_006 },
			{ updatedAt: ADDED_AT }
		]) {
			expect(wishlistItemSchema.safeParse(item(extra)).success, JSON.stringify(extra)).toBe(false);
		}
	});

	it('refuses an unknown key inside the variant too', () => {
		expect(
			wishlistItemSchema.safeParse(item({ variant: { wear: 'Field-Tested', float: 0.21 } })).success
		).toBe(false);
	});
});

describe('the persisted list', () => {
	it('accepts a v1 payload', () => {
		const parsed = persistedWishlistSchema.safeParse({ version: 1, items: [item()] });

		expect(parsed.success).toBe(true);
	});

	it('accepts an empty list', () => {
		expect(persistedWishlistSchema.safeParse({ version: 1, items: [] }).success).toBe(true);
	});

	it('refuses a version this build does not understand', () => {
		// A payload from a future build is discarded, never reinterpreted.
		for (const version of [0, 2, '1', undefined]) {
			expect(
				persistedWishlistSchema.safeParse({ version, items: [] }).success,
				String(version)
			).toBe(false);
		}
	});

	it('refuses more than the cap', () => {
		const many = Array.from({ length: MAX_WISHLIST_ITEMS + 1 }, (_, index) =>
			item({ skinSlug: `skin-${index}` })
		);

		expect(persistedWishlistSchema.safeParse({ version: 1, items: many }).success).toBe(false);
		expect(
			persistedWishlistSchema.safeParse({ version: 1, items: many.slice(0, MAX_WISHLIST_ITEMS) })
				.success
		).toBe(true);
		expect(MAX_WISHLIST_ITEMS).toBe(50);
	});

	it('refuses an unknown top-level field', () => {
		expect(
			persistedWishlistSchema.safeParse({ version: 1, items: [], syncedAt: ADDED_AT }).success
		).toBe(false);
	});
});

describe('the resolve request', () => {
	const identity = (overrides: Record<string, unknown> = {}) => ({
		skinSlug: 'ak-47-redline',
		variant: { wear: 'Field-Tested' },
		...overrides
	});

	it('accepts identities', () => {
		expect(wishlistResolveRequestSchema.safeParse({ items: [identity()] }).success).toBe(true);
	});

	it('accepts an empty list, because restoring is tolerant', () => {
		expect(wishlistResolveRequestSchema.safeParse({ items: [] }).success).toBe(true);
	});

	it('refuses the snapshot and the timestamp', () => {
		// The server has no use for them, and a payload carrying them would
		// invite it to start trusting numbers a client wrote.
		for (const extra of [{ addedAt: ADDED_AT }, { addedPriceMinor: 1000, currency: 'BRL' }]) {
			expect(
				wishlistResolveRequestSchema.safeParse({ items: [identity(extra)] }).success,
				JSON.stringify(extra)
			).toBe(false);
		}
	});

	it('refuses the same exact variant twice', () => {
		expect(
			wishlistResolveRequestSchema.safeParse({ items: [identity(), identity()] }).success
		).toBe(false);
	});

	it('allows two variants of one skin', () => {
		expect(
			wishlistResolveRequestSchema.safeParse({
				items: [identity(), identity({ variant: { wear: 'Minimal Wear' } })]
			}).success
		).toBe(true);
	});

	it('refuses more than the cap', () => {
		const many = Array.from({ length: MAX_WISHLIST_ITEMS + 1 }, (_, index) =>
			identity({ skinSlug: `skin-${index}` })
		);

		expect(wishlistResolveRequestSchema.safeParse({ items: many }).success).toBe(false);
	});
});
