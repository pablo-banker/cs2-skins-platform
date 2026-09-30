import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addToWishlist,
	clearWishlist,
	readWishlist,
	removeFromWishlist,
	writeWishlist
} from './persistence';
import { MAX_WISHLIST_ITEMS, WISHLIST_STORAGE_KEY } from '$lib/schemas/wishlist';
import type { WishlistItem } from '$lib/schemas/wishlist';

/** A stand-in for `localStorage` whose behaviour each test can bend. */
function fakeStorage() {
	const map = new Map<string, string>();

	return {
		getItem: vi.fn((key: string) => map.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => void map.set(key, value)),
		removeItem: vi.fn((key: string) => void map.delete(key)),
		clear: vi.fn(() => map.clear()),
		key: vi.fn(() => null),
		get length() {
			return map.size;
		},
		raw: map
	};
}

let store: ReturnType<typeof fakeStorage>;

function item(overrides: Partial<WishlistItem> = {}): WishlistItem {
	return {
		skinSlug: 'ak-47-redline',
		variant: { wear: 'Field-Tested' },
		addedAt: '2026-09-29T10:00:00.000Z',
		addedPriceMinor: 15_300,
		currency: 'BRL',
		...overrides
	};
}

/** Fills the list to exactly the cap, oldest first by slug. */
function fillToCapacity() {
	for (let index = 0; index < MAX_WISHLIST_ITEMS; index++) {
		addToWishlist(
			item({
				skinSlug: `skin-${String(index).padStart(3, '0')}`,
				addedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
			})
		);
	}
}

function stored() {
	const raw = store.raw.get(WISHLIST_STORAGE_KEY);

	return raw ? JSON.parse(raw) : undefined;
}

beforeEach(() => {
	store = fakeStorage();
	vi.stubGlobal('localStorage', store);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('saving and restoring', () => {
	it('starts empty', () => {
		expect(readWishlist()).toEqual([]);
	});

	it('writes a versioned payload under the wishlist key', () => {
		expect(writeWishlist([item()])).toBe(true);

		expect(stored()).toEqual({ version: 1, items: [item()] });
	});

	it('reads back exactly what was written', () => {
		writeWishlist([item()]);

		expect(readWishlist()).toEqual([item()]);
	});

	it('removes the key rather than storing an empty list', () => {
		writeWishlist([item()]);
		writeWishlist([]);

		expect(store.raw.has(WISHLIST_STORAGE_KEY)).toBe(false);
	});

	it('keeps no market data beyond the add-time snapshot', () => {
		addToWishlist(item());

		const raw = store.raw.get(WISHLIST_STORAGE_KEY) ?? '';

		// The snapshot is allowed and labelled. A current price, a provider or
		// an item id would mean live market state had leaked into storage.
		expect(raw).toContain('addedPriceMinor');
		expect(raw).not.toMatch(/itemId|providerId|currentPrice|marketHashName|updatedAt/);
	});
});

describe('adding', () => {
	it('adds an item', () => {
		expect(addToWishlist(item())).toEqual({ status: 'added', items: [item()] });
		expect(readWishlist()).toHaveLength(1);
	});

	it('does not add the same exact variant twice', () => {
		addToWishlist(item());
		const after = addToWishlist(item({ addedAt: '2026-09-30T10:00:00.000Z' }));

		expect(after.status).toBe('already-saved');
		expect(after.items).toHaveLength(1);
	});

	it('never refreshes the baseline of something already saved', () => {
		// The comparison someone is keeping must not silently reset because
		// they pressed the button again.
		addToWishlist(item({ addedPriceMinor: 15_300 }));
		addToWishlist(item({ addedPriceMinor: 99_999, addedAt: '2026-10-01T10:00:00.000Z' }));

		expect(readWishlist()[0].addedPriceMinor).toBe(15_300);
		expect(readWishlist()[0].addedAt).toBe('2026-09-29T10:00:00.000Z');
	});

	it('takes a new baseline after a remove and a re-add', () => {
		// Which is the one way to re-establish one, and it is deliberate.
		addToWishlist(item({ addedPriceMinor: 15_300 }));
		removeFromWishlist(item());
		addToWishlist(item({ addedPriceMinor: 12_000, addedAt: '2026-10-01T10:00:00.000Z' }));

		expect(readWishlist()[0].addedPriceMinor).toBe(12_000);
	});

	it('keeps two exteriors of one skin apart', () => {
		addToWishlist(item({ variant: { wear: 'Field-Tested' } }));
		addToWishlist(item({ variant: { wear: 'Minimal Wear' }, addedAt: '2026-09-30T10:00:00.000Z' }));

		expect(readWishlist()).toHaveLength(2);
	});

	it('saves an item with no baseline at all', () => {
		// Nothing currently listed is not a reason to refuse the save.
		const { status, items } = addToWishlist({
			skinSlug: 'awp-silk-tiger',
			variant: {},
			addedAt: '2026-09-29T10:00:00.000Z'
		});

		expect(status).toBe('added');
		expect(items).toHaveLength(1);
		expect(items[0].addedPriceMinor).toBeUndefined();
	});

	it('puts the newest first', () => {
		addToWishlist(item({ skinSlug: 'older', addedAt: '2026-09-01T00:00:00.000Z' }));
		addToWishlist(item({ skinSlug: 'newer', addedAt: '2026-09-29T00:00:00.000Z' }));

		expect(readWishlist().map((entry) => entry.skinSlug)).toEqual(['newer', 'older']);
	});

	it('refuses the save at capacity rather than deleting something', () => {
		fillToCapacity();

		const before = store.raw.get(WISHLIST_STORAGE_KEY);
		const after = addToWishlist(item({ skinSlug: 'newest', addedAt: '2026-12-31T00:00:00.000Z' }));

		expect(after.status).toBe('full');
		// Exactly fifty, and the same fifty.
		expect(after.items).toHaveLength(MAX_WISHLIST_ITEMS);
		expect(readWishlist()).toHaveLength(MAX_WISHLIST_ITEMS);
		// Every existing entry is something a person deliberately saved.
		expect(store.raw.get(WISHLIST_STORAGE_KEY)).toBe(before);
	});

	it('keeps the oldest entry when a save is refused', () => {
		fillToCapacity();

		addToWishlist(item({ skinSlug: 'newest', addedAt: '2026-12-31T00:00:00.000Z' }));

		const slugs = readWishlist().map((entry) => entry.skinSlug);

		expect(slugs).toContain('skin-000');
		expect(slugs).not.toContain('newest');
	});

	it('writes nothing at all when a save is refused', () => {
		fillToCapacity();
		store.setItem.mockClear();

		addToWishlist(item({ skinSlug: 'newest', addedAt: '2026-12-31T00:00:00.000Z' }));

		expect(store.setItem).not.toHaveBeenCalled();
	});

	it('accepts a save again once something is removed', () => {
		fillToCapacity();

		removeFromWishlist({ skinSlug: 'skin-000', variant: { wear: 'Field-Tested' } });

		const after = addToWishlist(item({ skinSlug: 'newest', addedAt: '2026-12-31T00:00:00.000Z' }));

		expect(after.status).toBe('added');
		expect(after.items).toHaveLength(MAX_WISHLIST_ITEMS);
	});

	it('still reports an existing item as saved at capacity', () => {
		fillToCapacity();

		// "Full" is about making room for something new, not about an entry
		// that is already there.
		const after = addToWishlist(item({ skinSlug: 'skin-000' }));

		expect(after.status).toBe('already-saved');
	});
});

describe('removing and clearing', () => {
	it('removes one exact variant', () => {
		addToWishlist(item({ variant: { wear: 'Field-Tested' } }));
		addToWishlist(item({ variant: { wear: 'Minimal Wear' }, addedAt: '2026-09-30T10:00:00.000Z' }));

		const after = removeFromWishlist({
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Field-Tested' }
		});

		expect(after).toHaveLength(1);
		expect(after[0].variant.wear).toBe('Minimal Wear');
	});

	it('does nothing for something that was never saved', () => {
		addToWishlist(item());

		expect(removeFromWishlist({ skinSlug: 'awp-redline', variant: {} })).toHaveLength(1);
	});

	it('removes the key when the last item goes', () => {
		addToWishlist(item());
		removeFromWishlist(item());

		expect(store.raw.has(WISHLIST_STORAGE_KEY)).toBe(false);
	});

	it('clears everything', () => {
		addToWishlist(item());
		addToWishlist(item({ skinSlug: 'awp-redline', addedAt: '2026-09-30T10:00:00.000Z' }));

		clearWishlist();

		expect(readWishlist()).toEqual([]);
		expect(store.raw.has(WISHLIST_STORAGE_KEY)).toBe(false);
	});
});

describe('when storage misbehaves', () => {
	it('reads nothing from corrupt JSON', () => {
		store.raw.set(WISHLIST_STORAGE_KEY, '{not json');

		expect(readWishlist()).toEqual([]);
	});

	it('reads nothing from a payload that fails validation', () => {
		store.raw.set(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ nope: true }] }));

		expect(readWishlist()).toEqual([]);
	});

	it('reads nothing from a version it does not understand', () => {
		store.raw.set(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 2, items: [item()] }));

		expect(readWishlist()).toEqual([]);
	});

	it('survives a read that throws', () => {
		store.getItem.mockImplementation(() => {
			throw new Error('site data blocked');
		});

		expect(readWishlist()).toEqual([]);
	});

	it('survives a write that throws, and says it failed', () => {
		store.setItem.mockImplementation(() => {
			throw new Error('quota exceeded');
		});

		expect(writeWishlist([item()])).toBe(false);
		// The page keeps working; only the save is lost.
		expect(() => addToWishlist(item())).not.toThrow();
	});

	it('survives storage being absent entirely', () => {
		vi.stubGlobal('localStorage', undefined);

		expect(readWishlist()).toEqual([]);
		expect(writeWishlist([item()])).toBe(false);
		expect(() => clearWishlist()).not.toThrow();
	});

	it('still answers for this session when nothing can be stored', () => {
		vi.stubGlobal('localStorage', undefined);

		// The add cannot be saved, but the caller gets the list it would have
		// been — so the button flips and the page keeps working. Losing the
		// save is a disappointment; a control that ignores a click is a bug.
		expect(addToWishlist(item())).toEqual({ status: 'added', items: [item()] });
		// And nothing survives, which is the honest consequence.
		expect(readWishlist()).toEqual([]);
	});

	it('survives even getting hold of storage throwing', () => {
		// Safari with site data blocked does exactly this.
		vi.stubGlobal('localStorage', {
			get getItem(): never {
				throw new Error('blocked');
			}
		});

		expect(readWishlist()).toEqual([]);
	});
});

describe('importing it on the server', () => {
	it('touches no storage at module scope', async () => {
		vi.stubGlobal('localStorage', undefined);

		// Importing during SSR must do nothing at all.
		await expect(import('./persistence')).resolves.toBeDefined();
	});
});
