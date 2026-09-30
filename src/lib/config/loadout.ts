/**
 * The loadout the builder lets someone assemble.
 *
 * **This is product configuration, not catalog discovery.** The shape of the
 * builder — which slots exist, what they are called, what order they appear
 * in — is a UX decision. If CS2Cap starts reporting a base name we have never
 * seen, that must not silently grow a new section on `/build`; someone looks
 * at it first and edits this file. A test checks every slot here against the
 * real catalog, so the two can drift apart loudly rather than quietly.
 *
 * Derived from the live catalog on 2026-09-22: 21,524 weapon entries grouping
 * into 1,974 skins, every one of which is reachable through exactly one slot
 * below.
 */
import type { Skin } from '$lib/types/skin';

export const LOADOUT_CATEGORIES = [
	'equipment',
	'pistols',
	'smgs',
	'rifles',
	'snipers',
	'heavy'
] as const;

export type LoadoutCategoryId = (typeof LOADOUT_CATEGORIES)[number];

export const LOADOUT_CATEGORY_LABELS: Record<LoadoutCategoryId, string> = {
	equipment: 'Equipment',
	pistols: 'Pistols',
	smgs: 'SMGs',
	rifles: 'Rifles',
	snipers: 'Snipers',
	heavy: 'Heavy'
};

/**
 * How a slot decides which catalog skins belong in it.
 *
 * - `weapon` — one base name, matched exactly. Every firearm works this way,
 *   and it is exact rather than a substring test so `MP5-SD` can never pull in
 *   `MP5` lookalikes or `P90` match `P90-something` in a future catalog.
 * - `subtype` — a catalog grouping. Knives and gloves are single slots holding
 *   many base names (twenty knife types, eight glove types), and `itemSubtype`
 *   is the normalized field that identifies them. Matching on the name would
 *   mean guessing that "Hand Wraps" are gloves.
 */
export type SlotMatcher = { kind: 'weapon'; weapon: string } | { kind: 'subtype'; subtype: string };

export type LoadoutSlotConfig = {
	/** Stable id. Appears in URLs and saved loadouts — do not rename lightly. */
	id: string;
	label: string;
	category: LoadoutCategoryId;
	match: SlotMatcher;
};

/**
 * Every slot, in display order.
 *
 * Knife and Gloves are **one slot each**, not one per knife type: nobody
 * equips a Karambit and a Bayonet, and twenty knife slots would be a wall of
 * empty boxes. The picker browses the whole family inside the one slot.
 *
 * The Zeus is here because it is genuinely skinnable (seven finishes in the
 * catalog) and someone building a complete inventory would notice its absence.
 */
export const LOADOUT_SLOTS: readonly LoadoutSlotConfig[] = [
	{
		id: 'knife',
		label: 'Knife',
		category: 'equipment',
		match: { kind: 'subtype', subtype: 'Knives' }
	},
	{
		id: 'gloves',
		label: 'Gloves',
		category: 'equipment',
		match: { kind: 'subtype', subtype: 'Gloves' }
	},
	{
		id: 'zeus',
		label: 'Zeus x27',
		category: 'equipment',
		match: { kind: 'weapon', weapon: 'Zeus x27' }
	},

	{
		id: 'glock-18',
		label: 'Glock-18',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'Glock-18' }
	},
	{ id: 'usp-s', label: 'USP-S', category: 'pistols', match: { kind: 'weapon', weapon: 'USP-S' } },
	{ id: 'p2000', label: 'P2000', category: 'pistols', match: { kind: 'weapon', weapon: 'P2000' } },
	{ id: 'p250', label: 'P250', category: 'pistols', match: { kind: 'weapon', weapon: 'P250' } },
	{
		id: 'five-seven',
		label: 'Five-SeveN',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'Five-SeveN' }
	},
	{ id: 'tec-9', label: 'Tec-9', category: 'pistols', match: { kind: 'weapon', weapon: 'Tec-9' } },
	{
		id: 'cz75-auto',
		label: 'CZ75-Auto',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'CZ75-Auto' }
	},
	{
		id: 'dual-berettas',
		label: 'Dual Berettas',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'Dual Berettas' }
	},
	{
		id: 'desert-eagle',
		label: 'Desert Eagle',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'Desert Eagle' }
	},
	{
		id: 'r8-revolver',
		label: 'R8 Revolver',
		category: 'pistols',
		match: { kind: 'weapon', weapon: 'R8 Revolver' }
	},

	{ id: 'mac-10', label: 'MAC-10', category: 'smgs', match: { kind: 'weapon', weapon: 'MAC-10' } },
	{ id: 'mp9', label: 'MP9', category: 'smgs', match: { kind: 'weapon', weapon: 'MP9' } },
	{ id: 'mp7', label: 'MP7', category: 'smgs', match: { kind: 'weapon', weapon: 'MP7' } },
	{ id: 'mp5-sd', label: 'MP5-SD', category: 'smgs', match: { kind: 'weapon', weapon: 'MP5-SD' } },
	{ id: 'ump-45', label: 'UMP-45', category: 'smgs', match: { kind: 'weapon', weapon: 'UMP-45' } },
	{ id: 'p90', label: 'P90', category: 'smgs', match: { kind: 'weapon', weapon: 'P90' } },
	{
		id: 'pp-bizon',
		label: 'PP-Bizon',
		category: 'smgs',
		match: { kind: 'weapon', weapon: 'PP-Bizon' }
	},

	{ id: 'ak-47', label: 'AK-47', category: 'rifles', match: { kind: 'weapon', weapon: 'AK-47' } },
	{ id: 'm4a4', label: 'M4A4', category: 'rifles', match: { kind: 'weapon', weapon: 'M4A4' } },
	{
		id: 'm4a1-s',
		label: 'M4A1-S',
		category: 'rifles',
		match: { kind: 'weapon', weapon: 'M4A1-S' }
	},
	{
		id: 'galil-ar',
		label: 'Galil AR',
		category: 'rifles',
		match: { kind: 'weapon', weapon: 'Galil AR' }
	},
	{ id: 'famas', label: 'FAMAS', category: 'rifles', match: { kind: 'weapon', weapon: 'FAMAS' } },
	{
		id: 'sg-553',
		label: 'SG 553',
		category: 'rifles',
		match: { kind: 'weapon', weapon: 'SG 553' }
	},
	{ id: 'aug', label: 'AUG', category: 'rifles', match: { kind: 'weapon', weapon: 'AUG' } },

	{ id: 'awp', label: 'AWP', category: 'snipers', match: { kind: 'weapon', weapon: 'AWP' } },
	{
		id: 'ssg-08',
		label: 'SSG 08',
		category: 'snipers',
		match: { kind: 'weapon', weapon: 'SSG 08' }
	},
	{
		id: 'scar-20',
		label: 'SCAR-20',
		category: 'snipers',
		match: { kind: 'weapon', weapon: 'SCAR-20' }
	},
	{ id: 'g3sg1', label: 'G3SG1', category: 'snipers', match: { kind: 'weapon', weapon: 'G3SG1' } },

	{ id: 'nova', label: 'Nova', category: 'heavy', match: { kind: 'weapon', weapon: 'Nova' } },
	{ id: 'xm1014', label: 'XM1014', category: 'heavy', match: { kind: 'weapon', weapon: 'XM1014' } },
	{ id: 'mag-7', label: 'MAG-7', category: 'heavy', match: { kind: 'weapon', weapon: 'MAG-7' } },
	{
		id: 'sawed-off',
		label: 'Sawed-Off',
		category: 'heavy',
		match: { kind: 'weapon', weapon: 'Sawed-Off' }
	},
	{ id: 'm249', label: 'M249', category: 'heavy', match: { kind: 'weapon', weapon: 'M249' } },
	{ id: 'negev', label: 'Negev', category: 'heavy', match: { kind: 'weapon', weapon: 'Negev' } }
] as const;

const slotsById = new Map(LOADOUT_SLOTS.map((slot) => [slot.id, slot]));

export function getLoadoutSlot(slotId: string): LoadoutSlotConfig | undefined {
	return slotsById.get(slotId);
}

/** Slots grouped for display, in category then slot order. */
export function loadoutSections(): {
	category: LoadoutCategoryId;
	label: string;
	slots: LoadoutSlotConfig[];
}[] {
	return LOADOUT_CATEGORIES.map((category) => ({
		category,
		label: LOADOUT_CATEGORY_LABELS[category],
		slots: LOADOUT_SLOTS.filter((slot) => slot.category === category)
	}));
}

/** Whether a catalog skin belongs in this slot. */
export function slotAcceptsSkin(slot: LoadoutSlotConfig, skin: Skin): boolean {
	return slot.match.kind === 'weapon'
		? skin.weapon === slot.match.weapon
		: skin.itemSubtype === slot.match.subtype;
}

/**
 * The slot a skin belongs to, if any.
 *
 * Every skin in the catalog reaches exactly one slot — verified against the
 * live catalog — so this is a lookup rather than a search with ties.
 */
export function slotForSkin(skin: Skin): LoadoutSlotConfig | undefined {
	return LOADOUT_SLOTS.find((slot) => slotAcceptsSkin(slot, skin));
}
