import { describe, expect, it } from 'vitest';
import { getSmartCoreEntry, SMART_CORE, smartCoreSlotIds, smartCoreSlots } from './smart-loadout';
import { getLoadoutSlot, LOADOUT_SLOTS } from './loadout';

describe('the Smart Core', () => {
	it('gives every entry a unique id and label', () => {
		expect(new Set(SMART_CORE.map((entry) => entry.id)).size).toBe(SMART_CORE.length);
		expect(new Set(SMART_CORE.map((entry) => entry.label)).size).toBe(SMART_CORE.length);
	});

	it('names only slots the builder registry actually has', () => {
		for (const slotId of smartCoreSlotIds()) {
			expect(getLoadoutSlot(slotId), slotId).toBeDefined();
		}
	});

	it('stays far smaller than the builder', () => {
		// A generated loadout is a few pieces someone will carry, not a
		// mandatory inventory of every gun in the game.
		expect(SMART_CORE.length).toBeLessThan(LOADOUT_SLOTS.length / 3);
	});

	it('never lists the same slot in two entries', () => {
		const slotIds = smartCoreSlotIds();

		expect(new Set(slotIds).size).toBe(slotIds.length);
	});

	it('treats the CT pistol and rifle as alternatives, not as two slots', () => {
		// A player carries a USP-S or a P2000, never both; two required slots
		// would generate a loadout nobody could use.
		expect(getSmartCoreEntry('ct-pistol')?.slotIds).toEqual(['usp-s', 'p2000']);
		expect(getSmartCoreEntry('ct-rifle')?.slotIds).toEqual(['m4a1-s', 'm4a4']);
	});

	it('keeps the AK-47 and the Glock as the T side, with no alternative', () => {
		expect(getSmartCoreEntry('t-rifle')?.slotIds).toEqual(['ak-47']);
		expect(getSmartCoreEntry('t-pistol')?.slotIds).toEqual(['glock-18']);
	});

	it('makes only the knife and gloves optional', () => {
		// They can cost more than every gun combined.
		expect(SMART_CORE.filter((entry) => entry.optional).map((entry) => entry.id)).toEqual([
			'knife',
			'gloves'
		]);
	});

	it('resolves an entry to its builder slots', () => {
		expect(smartCoreSlots(getSmartCoreEntry('ct-rifle')!).map((slot) => slot.label)).toEqual([
			'M4A1-S',
			'M4A4'
		]);
	});

	it('finds nothing for an id that is not in the core', () => {
		expect(getSmartCoreEntry('negev')).toBeUndefined();
	});
});
