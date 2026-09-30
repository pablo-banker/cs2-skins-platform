import { describe, expect, it } from 'vitest';
import {
	decodeLoadout,
	encodeLoadout,
	MAX_SHARE_PAYLOAD,
	SHARE_PARAM,
	SHARE_VERSION,
	shareUrl
} from './share';
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import type { Loadout, LoadoutSelection } from '$lib/types/loadout';

function selection(
	slotId: string,
	skinSlug: string,
	variant: LoadoutSelection['variant'] = {}
): LoadoutSelection {
	return { slotId, skinSlug, variant };
}

function loadout(...selections: LoadoutSelection[]): Loadout {
	return { selections };
}

/** Encodes and decodes, failing loudly if either step refuses. */
function roundTrip(input: Loadout): LoadoutSelection[] {
	const payload = encodeLoadout(input);
	expect(payload).toBeDefined();

	const decoded = decodeLoadout(payload!);
	expect(decoded.ok).toBe(true);

	return decoded.ok ? decoded.selections : [];
}

describe('encoding', () => {
	it('marks the format version', () => {
		expect(encodeLoadout(loadout(selection('ak-47', 'ak-47-redline')))).toMatch(
			new RegExp(`^${SHARE_VERSION}\\.`)
		);
	});

	it('produces a URL-safe payload', () => {
		const payload = encodeLoadout(
			loadout(selection('knife', 'karambit-doppler', { wear: 'Factory New', phase: 'Phase 2' }))
		)!;

		// base64url: no +, / or = to be mangled by a query string.
		expect(payload).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
		expect(encodeURIComponent(payload)).toBe(payload);
	});

	it('carries no upstream identifier', () => {
		const payload = encodeLoadout(loadout(selection('ak-47', 'ak-47-redline')))!;
		const decoded = atob(payload.slice(3).replaceAll('-', '+').replaceAll('_', '/'));

		expect(decoded).not.toMatch(/itemId|item_id|marketHash|lowest_ask|price/i);
		expect(decoded).not.toMatch(/\b\d{4,}\b/);
	});

	it('encodes an empty loadout as an empty list', () => {
		expect(roundTrip(loadout())).toEqual([]);
	});
});

describe('round trips', () => {
	it('restores one selection exactly', () => {
		expect(
			roundTrip(loadout(selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' })))
		).toEqual([selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' })]);
	});

	it('restores a selection with no variant preference', () => {
		expect(roundTrip(loadout(selection('knife', 'bayonet')))).toEqual([
			selection('knife', 'bayonet')
		]);
	});

	it('restores every variant field, exactly', () => {
		// The whole promise of a shared link: the creator's exact choice, not a
		// representative one.
		const exact = selection('knife', 'karambit-doppler', {
			wear: 'Factory New',
			edition: 'stattrak',
			phase: 'Phase 4'
		});

		expect(roundTrip(loadout(exact))).toEqual([exact]);
	});

	it('restores an edition without a wear', () => {
		const odd = selection('gloves', 'sport-gloves-vice', { edition: 'souvenir' });

		expect(roundTrip(loadout(odd))).toEqual([odd]);
	});

	it('restores a phase without an edition', () => {
		const odd = selection('knife', 'karambit-doppler', { wear: 'Factory New', phase: 'Ruby' });

		expect(roundTrip(loadout(odd))).toEqual([odd]);
	});

	it('restores Unicode intact', () => {
		// Nothing in the catalog needs this today, but an ASCII-only codec is a
		// trap that springs the day something does.
		const unicode = selection('knife', 'karambit-doppler', { phase: 'Фаза 2 — 壱 · ✦ 🎯' });

		expect(roundTrip(loadout(unicode))).toEqual([unicode]);
	});

	it('restores a full 37-slot loadout', () => {
		const full = loadout(
			...LOADOUT_SLOTS.map((slot) =>
				selection(slot.id, `${slot.id}-some-finish`, {
					wear: 'Battle-Scarred',
					edition: 'stattrak'
				})
			)
		);

		expect(roundTrip(full)).toHaveLength(LOADOUT_SLOTS.length);
	});
});

describe('determinism', () => {
	it('encodes the same loadout the same way every time', () => {
		const input = loadout(
			selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' }),
			selection('awp', 'awp-asiimov')
		);

		expect(encodeLoadout(input)).toBe(encodeLoadout(input));
	});

	it('ignores the order the slots were filled in', () => {
		// Two people who built the same loadout get the same link, and a link
		// does not churn because someone re-picked a slot.
		const forwards = loadout(
			selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' }),
			selection('knife', 'bayonet'),
			selection('awp', 'awp-asiimov')
		);
		const backwards = loadout(
			selection('awp', 'awp-asiimov'),
			selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' }),
			selection('knife', 'bayonet')
		);

		expect(encodeLoadout(backwards)).toBe(encodeLoadout(forwards));
	});

	it('orders decoded selections by the registry, not by insertion', () => {
		const decoded = roundTrip(
			loadout(selection('awp', 'awp-asiimov'), selection('knife', 'bayonet'))
		);

		// Knife comes first in the registry.
		expect(decoded.map((entry) => entry.slotId)).toEqual(['knife', 'awp']);
	});
});

describe('decoding hostile input', () => {
	it('rejects an empty or non-string payload', () => {
		expect(decodeLoadout('')).toEqual({ ok: false, error: 'malformed' });
		expect(decodeLoadout(undefined as unknown as string).ok).toBe(false);
		expect(decodeLoadout(42 as unknown as string).ok).toBe(false);
	});

	it('rejects a payload with no version marker', () => {
		expect(decodeLoadout('W1siYWstNDciXV0')).toEqual({ ok: false, error: 'malformed' });
	});

	it('refuses to read a future version as this one', () => {
		const v1 = encodeLoadout(loadout(selection('ak-47', 'ak-47-redline')))!;
		const v2 = v1.replace('v1.', 'v2.');

		expect(decodeLoadout(v2)).toEqual({ ok: false, error: 'unsupported-version' });
	});

	it('rejects a payload larger than the limit', () => {
		expect(decodeLoadout(`v1.${'A'.repeat(MAX_SHARE_PAYLOAD)}`)).toEqual({
			ok: false,
			error: 'too-large'
		});
	});

	it('rejects base64 that is not JSON', () => {
		expect(decodeLoadout(`v1.${btoa('not json at all').replaceAll('=', '')}`).ok).toBe(false);
	});

	it('rejects JSON that is not a list of tuples', () => {
		for (const body of ['{"a":1}', '"string"', '[1,2,3]', '[[]]', '[["only-one"]]', 'null']) {
			const payload = `v1.${btoa(body).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;

			expect(decodeLoadout(payload).ok, body).toBe(false);
		}
	});

	it('rejects a tuple with a non-string member', () => {
		const body = JSON.stringify([['ak-47', 'ak-47-redline', 12632]]);
		const payload = `v1.${btoa(body).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;

		expect(decodeLoadout(payload).ok).toBe(false);
	});

	it('rejects more selections than there are slots', () => {
		const body = JSON.stringify(
			Array.from({ length: LOADOUT_SLOTS.length + 1 }, (_, index) => [`slot-${index}`, 'a-skin'])
		);
		const payload = `v1.${btoa(body).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;

		expect(decodeLoadout(payload)).toEqual({ ok: false, error: 'malformed' });
	});

	it('never throws, whatever it is handed', () => {
		for (const nonsense of ['v1.', 'v1.!!!!', 'v1.====', 'vv.abc', 'v1.' + '%'.repeat(100)]) {
			expect(() => decodeLoadout(nonsense), nonsense).not.toThrow();
		}
	});

	it('decodes what a stranger sent without vouching for it', () => {
		// The codec returns what the link said; whether an unknown slot or a
		// bogus edition describes anything real is the server's call.
		const body = JSON.stringify([['not-a-slot', 'not-a-skin', 'Not A Wear', 'holo']]);
		const payload = `v1.${btoa(body).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;

		const decoded = decodeLoadout(payload);

		expect(decoded.ok).toBe(true);
	});
});

describe('shareUrl', () => {
	it('builds an absolute link on the running origin', () => {
		const url = shareUrl(loadout(selection('ak-47', 'ak-47-redline')), 'https://cs2skins.test')!;

		expect(url.startsWith('https://cs2skins.test/build?')).toBe(true);
		expect(new URL(url).searchParams.get(SHARE_PARAM)).toMatch(/^v1\./);
	});

	it('hardcodes no host', () => {
		const url = shareUrl(loadout(selection('ak-47', 'ak-47-redline')), 'http://localhost:4173')!;

		expect(url.startsWith('http://localhost:4173/build')).toBe(true);
	});

	it('round-trips through a real URL', () => {
		const original = loadout(
			selection('ak-47', 'ak-47-redline', { wear: 'Field-Tested' }),
			selection('knife', 'karambit-doppler', { wear: 'Factory New', phase: 'Phase 2' })
		);

		const url = new URL(shareUrl(original, 'https://cs2skins.test')!);
		const decoded = decodeLoadout(url.searchParams.get(SHARE_PARAM)!);

		// Registry order, not insertion order — see the determinism tests.
		expect(decoded.ok && decoded.selections).toEqual([
			original.selections[1],
			original.selections[0]
		]);
	});
});

/**
 * The worst realistic loadout, measured rather than guessed.
 *
 * Every slot filled with the longest real slug that slot can hold, the longest
 * exterior, StatTrak, and a phase on the knife. If this fits, everything fits.
 */
describe('size', () => {
	/**
	 * The longest slug in the real catalog is 40 characters
	 * (`specialist-gloves-chocolate-chesterfield`). Giving *every* slot one that
	 * long, plus the longest exterior, StatTrak and a phase, is worse than
	 * anything the catalog can currently produce.
	 */
	const LONGEST_REAL_SLUG = 'specialist-gloves-chocolate-chesterfield';

	const worstCase = loadout(
		...LOADOUT_SLOTS.map((slot) =>
			selection(slot.id, LONGEST_REAL_SLUG, {
				wear: 'Battle-Scarred',
				edition: 'stattrak',
				...(slot.id === 'knife' ? { phase: 'Black Pearl' } : {})
			})
		)
	);

	it('fits a full 37-slot loadout with room to spare', () => {
		const payload = encodeLoadout(worstCase)!;

		expect(payload).toBeDefined();
		// Comfortably inside the guard rather than scraping past it, so a
		// longer finish name in a future update cannot break sharing.
		expect(payload.length).toBeLessThan(MAX_SHARE_PAYLOAD * 0.6);
	});

	it('produces a URL browsers handle comfortably', () => {
		const url = shareUrl(worstCase, 'https://cs2skins.example.com')!;

		// Well under the ~8,000 characters browsers and proxies agree on.
		expect(url.length).toBeLessThan(6000);
	});

	it('refuses to build a link it could not read back', () => {
		// Only reachable with something pathological, but a broken URL is worse
		// than a refusal.
		const absurd = loadout(
			...LOADOUT_SLOTS.map((slot) => selection(slot.id, 'x'.repeat(120), { phase: 'y'.repeat(64) }))
		);

		expect(encodeLoadout(absurd)).toBeUndefined();
		expect(shareUrl(absurd, 'https://cs2skins.test')).toBeUndefined();
	});
});
