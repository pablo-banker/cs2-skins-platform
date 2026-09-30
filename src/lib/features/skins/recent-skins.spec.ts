import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_SKINS_LIMIT, readRecentSkins, rememberRecentSkin } from './recent-skins';

const KEY = 'cs2skins.recent-skins';

/** A minimal in-memory `localStorage`, so the module under test is unchanged. */
function fakeStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));

	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
		key: () => null,
		length: 0
	} as unknown as Storage;
}

function skin(slug: string) {
	return { slug, weapon: 'AK-47', name: slug, fullName: `AK-47 | ${slug}` };
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, 'localStorage');
	vi.restoreAllMocks();
});

describe('without a browser', () => {
	it('reads nothing during SSR instead of throwing', () => {
		// There is no localStorage on the server, and a personal convenience
		// has no business in a server-rendered page.
		expect(typeof localStorage).toBe('undefined');
		expect(readRecentSkins()).toEqual([]);
	});

	it('still returns the updated list when it cannot persist', () => {
		expect(rememberRecentSkin(skin('ak-47-redline'))).toHaveLength(1);
	});
});

describe('in a browser', () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: fakeStorage(),
			configurable: true,
			writable: true
		});
	});

	it('remembers a selection and reads it back', () => {
		rememberRecentSkin(skin('ak-47-redline'));

		expect(readRecentSkins()).toEqual([
			{
				slug: 'ak-47-redline',
				weapon: 'AK-47',
				name: 'ak-47-redline',
				fullName: 'AK-47 | ak-47-redline',
				imageUrl: undefined
			}
		]);
	});

	it('puts the newest selection first', () => {
		rememberRecentSkin(skin('a'));
		rememberRecentSkin(skin('b'));

		expect(readRecentSkins().map((item) => item.slug)).toEqual(['b', 'a']);
	});

	it('moves a repeated selection to the front instead of duplicating it', () => {
		rememberRecentSkin(skin('a'));
		rememberRecentSkin(skin('b'));
		rememberRecentSkin(skin('a'));

		expect(readRecentSkins().map((item) => item.slug)).toEqual(['a', 'b']);
	});

	it('stays bounded', () => {
		for (let i = 0; i < RECENT_SKINS_LIMIT + 5; i++) rememberRecentSkin(skin(`skin-${i}`));

		expect(readRecentSkins()).toHaveLength(RECENT_SKINS_LIMIT);
	});

	it('ignores storage that is not valid JSON', () => {
		localStorage.setItem(KEY, '{not json');

		expect(readRecentSkins()).toEqual([]);
	});

	it('ignores stored values of the wrong shape', () => {
		localStorage.setItem(KEY, JSON.stringify([{ nope: true }, 'string', null, skin('ok')]));

		expect(readRecentSkins().map((item) => item.slug)).toEqual(['ok']);
	});

	it('ignores storage that is not a list', () => {
		localStorage.setItem(KEY, JSON.stringify({ slug: 'a' }));

		expect(readRecentSkins()).toEqual([]);
	});

	it('survives storage that refuses to be written', () => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				...fakeStorage(),
				setItem: () => {
					throw new Error('QuotaExceededError');
				}
			},
			configurable: true,
			writable: true
		});

		expect(() => rememberRecentSkin(skin('a'))).not.toThrow();
	});

	it('stores only the fields a row needs', () => {
		rememberRecentSkin({
			...skin('a'),
			imageUrl: 'https://cdn.example.test/a.png',
			// Extra fields must not be persisted.
			...({ itemId: 12632, priceMinor: 999 } as object)
		});

		const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]')[0];
		expect(Object.keys(stored).sort()).toEqual(['fullName', 'imageUrl', 'name', 'slug', 'weapon']);
	});
});
