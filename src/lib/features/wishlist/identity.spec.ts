import { describe, expect, it } from 'vitest';
import { isInWishlist, wishlistItemKey, type WishlistIdentityLike } from './identity';

const base = { skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } };

describe('what makes two entries the same', () => {
	it('is the slug and the exact variant together', () => {
		expect(wishlistItemKey(base)).toBe(wishlistItemKey({ ...base }));
	});

	it('separates two exteriors of one skin', () => {
		// The whole reason identity is variant-level: these are two different
		// purchases at two different prices.
		expect(wishlistItemKey(base)).not.toBe(
			wishlistItemKey({ ...base, variant: { wear: 'Minimal Wear' } })
		);
	});

	it('separates two editions', () => {
		expect(
			wishlistItemKey({ ...base, variant: { wear: 'Field-Tested', edition: 'stattrak' } })
		).not.toBe(wishlistItemKey(base));
	});

	it('separates two phases', () => {
		const one = { skinSlug: 'karambit-doppler', variant: { phase: 'Phase 2' } };
		const two = { skinSlug: 'karambit-doppler', variant: { phase: 'Phase 4' } };

		expect(wishlistItemKey(one)).not.toBe(wishlistItemKey(two));
	});

	it('separates two skins', () => {
		expect(wishlistItemKey({ ...base, skinSlug: 'awp-redline' })).not.toBe(wishlistItemKey(base));
	});

	it('treats the plain edition and an unstated one as the same item', () => {
		// A link that spells out `edition=normal` must not create a second
		// entry beside one saved without it.
		expect(wishlistItemKey({ ...base, variant: { wear: 'Field-Tested', edition: 'normal' } })).toBe(
			wishlistItemKey(base)
		);
	});

	it('handles a variant with nothing specified', () => {
		expect(wishlistItemKey({ skinSlug: 'bayonet', variant: {} })).toBe(
			wishlistItemKey({ skinSlug: 'bayonet', variant: {} })
		);
	});

	it('is deterministic whatever order the fields were written in', () => {
		const a: WishlistIdentityLike = {
			skinSlug: 'x',
			variant: { wear: 'Factory New', phase: 'Ruby', edition: 'stattrak' }
		};
		const b: WishlistIdentityLike = {
			skinSlug: 'x',
			variant: { phase: 'Ruby', edition: 'stattrak', wear: 'Factory New' }
		};

		expect(wishlistItemKey(a)).toBe(wishlistItemKey(b));
	});
});

describe('membership', () => {
	const saved = [base, { skinSlug: 'awp-asiimov', variant: { wear: 'Factory New' } }];

	it('finds an exact variant', () => {
		expect(isInWishlist(saved, base)).toBe(true);
	});

	it('does not find a different exterior of a saved skin', () => {
		expect(isInWishlist(saved, { ...base, variant: { wear: 'Minimal Wear' } })).toBe(false);
	});

	it('does not find an unsaved skin', () => {
		expect(isInWishlist(saved, { skinSlug: 'awp-redline', variant: {} })).toBe(false);
	});

	it('finds nothing in an empty list', () => {
		expect(isInWishlist([], base)).toBe(false);
	});
});
