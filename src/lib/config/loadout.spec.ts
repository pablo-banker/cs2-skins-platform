import { describe, expect, it } from 'vitest';
import {
	getLoadoutSlot,
	LOADOUT_CATEGORIES,
	LOADOUT_CATEGORY_LABELS,
	LOADOUT_SLOTS,
	loadoutSections,
	slotAcceptsSkin,
	slotForSkin
} from './loadout';
import type { Skin } from '$lib/types/skin';

/**
 * A catalog skin, shaped the way the grouped index produces them.
 *
 * `itemSubtype` is what separates knives and gloves from firearms, so it is
 * part of every fixture here rather than an afterthought.
 */
function skin(weapon: string, name: string, itemSubtype: string): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: name ? `${weapon} | ${name}` : weapon,
		itemSubtype,
		variants: []
	};
}

describe('slot registry', () => {
	it('gives every slot a unique id', () => {
		const ids = LOADOUT_SLOTS.map((slot) => slot.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every slot a unique label', () => {
		const labels = LOADOUT_SLOTS.map((slot) => slot.label);

		expect(new Set(labels).size).toBe(labels.length);
	});

	it('puts every slot in a known category', () => {
		for (const slot of LOADOUT_SLOTS) {
			expect(LOADOUT_CATEGORIES).toContain(slot.category);
		}
	});

	it('labels every category', () => {
		for (const category of LOADOUT_CATEGORIES) {
			expect(LOADOUT_CATEGORY_LABELS[category]).toBeTruthy();
		}
	});

	it('never lists the same weapon in two slots', () => {
		const weapons = LOADOUT_SLOTS.filter((slot) => slot.match.kind === 'weapon').map((slot) =>
			slot.match.kind === 'weapon' ? slot.match.weapon : ''
		);

		expect(new Set(weapons).size).toBe(weapons.length);
	});

	it('never lists the same subtype in two slots', () => {
		const subtypes = LOADOUT_SLOTS.filter((slot) => slot.match.kind === 'subtype').map((slot) =>
			slot.match.kind === 'subtype' ? slot.match.subtype : ''
		);

		expect(new Set(subtypes).size).toBe(subtypes.length);
	});

	it('uses lowercase hyphenated slot ids, which saved loadouts will carry', () => {
		for (const slot of LOADOUT_SLOTS) {
			expect(slot.id, slot.label).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		}
	});

	it('covers the equipment a loadout is built around', () => {
		const ids = LOADOUT_SLOTS.map((slot) => slot.id);

		expect(ids).toContain('knife');
		expect(ids).toContain('gloves');
		// Genuinely skinnable, and a complete inventory would miss it.
		expect(ids).toContain('zeus');
	});

	it('has one knife slot and one gloves slot, not one per type', () => {
		// Twenty knife slots would be a wall of empty boxes; nobody equips a
		// Karambit and a Bayonet at once.
		expect(LOADOUT_SLOTS.filter((slot) => slot.match.kind === 'subtype')).toHaveLength(2);
	});

	it('finds a slot by id and nothing by a made-up one', () => {
		expect(getLoadoutSlot('ak-47')?.label).toBe('AK-47');
		expect(getLoadoutSlot('rocket-launcher')).toBeUndefined();
	});
});

describe('loadoutSections', () => {
	it('groups every slot exactly once, in category order', () => {
		const sections = loadoutSections();

		expect(sections.map((section) => section.category)).toEqual([...LOADOUT_CATEGORIES]);
		expect(sections.flatMap((section) => section.slots)).toHaveLength(LOADOUT_SLOTS.length);
	});

	it('leaves no category empty', () => {
		for (const section of loadoutSections()) {
			expect(section.slots.length, section.category).toBeGreaterThan(0);
		}
	});
});

describe('slotAcceptsSkin', () => {
	const ak = getLoadoutSlot('ak-47')!;
	const knife = getLoadoutSlot('knife')!;
	const gloves = getLoadoutSlot('gloves')!;
	const zeus = getLoadoutSlot('zeus')!;

	it('matches a firearm slot on the exact base name', () => {
		expect(slotAcceptsSkin(ak, skin('AK-47', 'Redline', 'Rifles'))).toBe(true);
		expect(slotAcceptsSkin(ak, skin('M4A4', 'Howl', 'Rifles'))).toBe(false);
	});

	it('does not match a name that merely contains the weapon', () => {
		// Exact, not a substring test: a future "AK-47-something" must not
		// silently land in the AK-47 slot.
		expect(slotAcceptsSkin(ak, skin('AK-47 Prototype', 'Redline', 'Rifles'))).toBe(false);
		expect(slotAcceptsSkin(getLoadoutSlot('mp5-sd')!, skin('MP5', 'Test', 'SMGs'))).toBe(false);
	});

	it('matches any knife by catalog subtype, whatever it is called', () => {
		expect(slotAcceptsSkin(knife, skin('Karambit', 'Doppler', 'Knives'))).toBe(true);
		expect(slotAcceptsSkin(knife, skin('Shadow Daggers', 'Fade', 'Knives'))).toBe(true);
		// A vanilla knife has no finish and is still a knife.
		expect(slotAcceptsSkin(knife, skin('Bayonet', '', 'Knives'))).toBe(true);
	});

	it('matches any gloves by catalog subtype, including ones not called gloves', () => {
		expect(slotAcceptsSkin(gloves, skin('Sport Gloves', 'Vice', 'Gloves'))).toBe(true);
		// "Hand Wraps" are gloves and the name does not say so — which is why
		// the matcher reads a normalized field rather than guessing.
		expect(slotAcceptsSkin(gloves, skin('Hand Wraps', 'Cobalt Skulls', 'Gloves'))).toBe(true);
	});

	it('keeps knives and gloves out of each other, and out of firearm slots', () => {
		expect(slotAcceptsSkin(knife, skin('Sport Gloves', 'Vice', 'Gloves'))).toBe(false);
		expect(slotAcceptsSkin(gloves, skin('Karambit', 'Doppler', 'Knives'))).toBe(false);
		expect(slotAcceptsSkin(ak, skin('Karambit', 'Doppler', 'Knives'))).toBe(false);
	});

	it('matches the Zeus, which has no weapon classification at all', () => {
		expect(slotAcceptsSkin(zeus, skin('Zeus x27', 'Tosai', 'Equipment'))).toBe(true);
	});

	it('does not match a skin whose subtype is missing', () => {
		const unknown: Skin = { ...skin('Karambit', 'Doppler', 'Knives'), itemSubtype: undefined };

		expect(slotAcceptsSkin(knife, unknown)).toBe(false);
	});
});

describe('slotForSkin', () => {
	it('routes each kind of skin to exactly one slot', () => {
		expect(slotForSkin(skin('AK-47', 'Redline', 'Rifles'))?.id).toBe('ak-47');
		expect(slotForSkin(skin('AWP', 'Asiimov', 'Rifles'))?.id).toBe('awp');
		expect(slotForSkin(skin('Karambit', 'Doppler', 'Knives'))?.id).toBe('knife');
		expect(slotForSkin(skin('Sport Gloves', 'Vice', 'Gloves'))?.id).toBe('gloves');
		expect(slotForSkin(skin('Zeus x27', 'Tosai', 'Equipment'))?.id).toBe('zeus');
	});

	it('returns nothing for a base name the registry does not know', () => {
		// A new upstream weapon must not silently grow a builder section.
		expect(slotForSkin(skin('Plasma Rifle', 'Nova', 'Rifles'))).toBeUndefined();
	});
});
