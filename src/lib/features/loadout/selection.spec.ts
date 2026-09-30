import { describe, expect, it } from 'vitest';
import {
	clearLoadout,
	clearSlot,
	EMPTY_LOADOUT,
	isEmpty,
	loadoutFingerprint,
	orderedSelections,
	selectionCount,
	selectionForSlot,
	selectSkin
} from './selection';
import type { Loadout } from '$lib/types/loadout';

function build(): Loadout {
	let loadout = EMPTY_LOADOUT;
	loadout = selectSkin(loadout, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' });
	loadout = selectSkin(loadout, 'knife', 'karambit-doppler', { phase: 'Phase 2' });

	return loadout;
}

describe('selectSkin', () => {
	it('fills a slot', () => {
		const loadout = selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' });

		expect(selectionCount(loadout)).toBe(1);
		expect(selectionForSlot(loadout, 'ak-47')).toEqual({
			slotId: 'ak-47',
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Field-Tested' }
		});
	});

	it('replaces rather than duplicating when the slot is already filled', () => {
		let loadout = selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', {});
		loadout = selectSkin(loadout, 'ak-47', 'ak-47-slate', {});

		expect(selectionCount(loadout)).toBe(1);
		expect(selectionForSlot(loadout, 'ak-47')?.skinSlug).toBe('ak-47-slate');
	});

	it('leaves other slots untouched', () => {
		const loadout = selectSkin(build(), 'awp', 'awp-asiimov', {});

		expect(selectionCount(loadout)).toBe(3);
		expect(selectionForSlot(loadout, 'ak-47')?.skinSlug).toBe('ak-47-redline');
	});

	it('does not mutate the loadout it was given', () => {
		const before = build();
		const snapshot = structuredClone(before);

		selectSkin(before, 'awp', 'awp-asiimov', {});

		expect(before).toEqual(snapshot);
	});

	it('drops empty variant fields so equivalent selections stay equivalent', () => {
		const explicit = selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', {
			wear: undefined,
			edition: undefined,
			phase: undefined
		});

		expect(selectionForSlot(explicit, 'ak-47')?.variant).toEqual({});
	});
});

describe('clearSlot and clearLoadout', () => {
	it('empties one slot and nothing else', () => {
		const loadout = clearSlot(build(), 'ak-47');

		expect(selectionForSlot(loadout, 'ak-47')).toBeUndefined();
		expect(selectionForSlot(loadout, 'knife')?.skinSlug).toBe('karambit-doppler');
	});

	it('ignores a slot that was never filled', () => {
		expect(selectionCount(clearSlot(build(), 'awp'))).toBe(2);
	});

	it('empties everything', () => {
		expect(isEmpty(clearLoadout())).toBe(true);
	});

	it('does not mutate its input', () => {
		const before = build();
		const snapshot = structuredClone(before);

		clearSlot(before, 'ak-47');

		expect(before).toEqual(snapshot);
	});
});

describe('orderedSelections', () => {
	it('returns selections in registry order, not the order they were added', () => {
		// The AWP was chosen last but comes after the knife and before nothing
		// else in the registry.
		let loadout = selectSkin(EMPTY_LOADOUT, 'awp', 'awp-asiimov', {});
		loadout = selectSkin(loadout, 'knife', 'karambit-doppler', {});
		loadout = selectSkin(loadout, 'ak-47', 'ak-47-redline', {});

		expect(orderedSelections(loadout).map((entry) => entry.slotId)).toEqual([
			'knife',
			'ak-47',
			'awp'
		]);
	});
});

describe('loadoutFingerprint', () => {
	it('is empty for an empty loadout', () => {
		expect(loadoutFingerprint(EMPTY_LOADOUT)).toBe('');
	});

	it('is deterministic for the same loadout', () => {
		expect(loadoutFingerprint(build())).toBe(loadoutFingerprint(build()));
	});

	it('ignores the order slots were filled in', () => {
		// The visitor picked the same skins; which one they clicked first is not
		// part of what they selected, and must not invalidate a calculation.
		let a = EMPTY_LOADOUT;
		a = selectSkin(a, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' });
		a = selectSkin(a, 'awp', 'awp-asiimov', {});

		let b = EMPTY_LOADOUT;
		b = selectSkin(b, 'awp', 'awp-asiimov', {});
		b = selectSkin(b, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' });

		expect(loadoutFingerprint(a)).toBe(loadoutFingerprint(b));
	});

	it('changes when the variant changes', () => {
		const before = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' })
		);
		const after = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', { wear: 'Minimal Wear' })
		);

		expect(after).not.toBe(before);
	});

	it('changes when the edition or phase changes', () => {
		const plain = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', { wear: 'Field-Tested' })
		);
		const stattrak = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', {
				wear: 'Field-Tested',
				edition: 'stattrak'
			})
		);
		const phased = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'knife', 'karambit-doppler', { phase: 'Phase 2' })
		);
		const otherPhase = loadoutFingerprint(
			selectSkin(EMPTY_LOADOUT, 'knife', 'karambit-doppler', { phase: 'Phase 4' })
		);

		expect(stattrak).not.toBe(plain);
		expect(otherPhase).not.toBe(phased);
	});

	it('changes when the skin changes', () => {
		const before = loadoutFingerprint(selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', {}));
		const after = loadoutFingerprint(selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-slate', {}));

		expect(after).not.toBe(before);
	});

	it('changes when the slot changes, even for the same skin', () => {
		const inKnife = loadoutFingerprint(selectSkin(EMPTY_LOADOUT, 'knife', 'bayonet', {}));
		const inGloves = loadoutFingerprint(selectSkin(EMPTY_LOADOUT, 'gloves', 'bayonet', {}));

		expect(inGloves).not.toBe(inKnife);
	});

	it('changes when a selection is removed', () => {
		const full = build();

		expect(loadoutFingerprint(clearSlot(full, 'ak-47'))).not.toBe(loadoutFingerprint(full));
	});

	it('treats an absent variant field and an empty one as the same selection', () => {
		const implicit = selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', {});
		const explicit = selectSkin(EMPTY_LOADOUT, 'ak-47', 'ak-47-redline', { wear: undefined });

		expect(loadoutFingerprint(explicit)).toBe(loadoutFingerprint(implicit));
	});
});
