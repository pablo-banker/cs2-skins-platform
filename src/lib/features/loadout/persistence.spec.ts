import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPersistedLoadout, readPersistedLoadout, writePersistedLoadout } from './persistence';
import { BUILDER_STORAGE_KEY } from '$lib/schemas/loadout-persistence';
import type { LoadoutSelection } from '$lib/types/loadout';

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

const SELECTIONS: LoadoutSelection[] = [
	{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
	{ slotId: 'knife', skinSlug: 'bayonet', variant: {} }
];

beforeEach(() => {
	store = fakeStorage();
	vi.stubGlobal('localStorage', store);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('saving and restoring', () => {
	it('writes a versioned payload under the builder key', () => {
		expect(writePersistedLoadout(SELECTIONS)).toBe(true);

		expect(JSON.parse(store.raw.get(BUILDER_STORAGE_KEY)!)).toEqual({
			version: 1,
			selections: SELECTIONS
		});
	});

	it('reads back exactly what was saved', () => {
		writePersistedLoadout(SELECTIONS);

		expect(readPersistedLoadout()).toEqual(SELECTIONS);
	});

	it('round-trips a variant with every field set', () => {
		const exact: LoadoutSelection[] = [
			{
				slotId: 'knife',
				skinSlug: 'karambit-doppler',
				variant: { wear: 'Factory New', edition: 'stattrak', phase: 'Phase 2' }
			}
		];

		writePersistedLoadout(exact);

		expect(readPersistedLoadout()).toEqual(exact);
	});

	it('stores no market data, however it is handed one', () => {
		writePersistedLoadout(SELECTIONS);

		const raw = store.raw.get(BUILDER_STORAGE_KEY)!;

		expect(raw).not.toMatch(/price|currency|provider|steam|total|itemId|marketHash/i);
	});

	it('returns nothing when there is nothing saved', () => {
		expect(readPersistedLoadout()).toBeUndefined();
	});
});

describe('clearing', () => {
	it('removes the key rather than storing an empty loadout', () => {
		// An empty record and no record read back the same; leaving one behind
		// is untidier on someone's machine for no gain.
		writePersistedLoadout(SELECTIONS);
		clearPersistedLoadout();

		expect(store.raw.has(BUILDER_STORAGE_KEY)).toBe(false);
		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('treats writing an empty list as clearing', () => {
		writePersistedLoadout(SELECTIONS);
		writePersistedLoadout([]);

		expect(store.removeItem).toHaveBeenCalledWith(BUILDER_STORAGE_KEY);
		expect(store.raw.has(BUILDER_STORAGE_KEY)).toBe(false);
	});
});

describe('storage that misbehaves', () => {
	it('survives corrupt JSON', () => {
		store.raw.set(BUILDER_STORAGE_KEY, '{not json');

		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('survives a payload that is valid JSON but the wrong shape', () => {
		store.raw.set(BUILDER_STORAGE_KEY, JSON.stringify({ version: 1, selections: 'nope' }));

		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('refuses a version it does not understand rather than guessing', () => {
		store.raw.set(
			BUILDER_STORAGE_KEY,
			JSON.stringify({ version: 2, selections: SELECTIONS, budget: 500 })
		);

		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('discards a payload carrying an upstream item id', () => {
		store.raw.set(
			BUILDER_STORAGE_KEY,
			JSON.stringify({ version: 1, selections: [{ ...SELECTIONS[0], itemId: 12632 }] })
		);

		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('survives a read that throws', () => {
		store.getItem.mockImplementation(() => {
			throw new DOMException('denied');
		});

		expect(() => readPersistedLoadout()).not.toThrow();
		expect(readPersistedLoadout()).toBeUndefined();
	});

	it('survives a write that throws, and says it failed', () => {
		store.setItem.mockImplementation(() => {
			throw new DOMException('quota exceeded');
		});

		expect(writePersistedLoadout(SELECTIONS)).toBe(false);
	});

	it('survives a remove that throws', () => {
		store.removeItem.mockImplementation(() => {
			throw new DOMException('denied');
		});

		expect(writePersistedLoadout([])).toBe(false);
	});

	it('survives storage being absent entirely', () => {
		vi.stubGlobal('localStorage', undefined);

		expect(readPersistedLoadout()).toBeUndefined();
		expect(writePersistedLoadout(SELECTIONS)).toBe(false);
		expect(() => clearPersistedLoadout()).not.toThrow();
	});

	it('survives even reaching for storage throwing', () => {
		// Safari with site data blocked throws on property access itself.
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('blocked');
			}
		});

		expect(readPersistedLoadout()).toBeUndefined();
		expect(writePersistedLoadout(SELECTIONS)).toBe(false);

		Reflect.deleteProperty(globalThis, 'localStorage');
	});
});

/**
 * This whole file runs in the node project — no `window`, no `document`, no
 * `localStorage` unless a test provides one. That is the SSR environment, so
 * importing and calling into this module here proves it is safe to render a
 * page that imports it.
 */
describe('server-side rendering', () => {
	it('imports and runs with no browser globals at all', async () => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(globalThis, 'localStorage');

		expect(typeof window).toBe('undefined');
		expect(typeof localStorage).toBe('undefined');

		const module = await import('./persistence');

		expect(() => module.readPersistedLoadout()).not.toThrow();
		expect(() => module.writePersistedLoadout(SELECTIONS)).not.toThrow();
		expect(() => module.clearPersistedLoadout()).not.toThrow();
		expect(module.readPersistedLoadout()).toBeUndefined();
	});
});
