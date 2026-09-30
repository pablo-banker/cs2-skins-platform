/**
 * The loadout Smart Loadout will generate.
 *
 * **Not the builder's 37 slots.** Someone asking for a generated loadout wants
 * a few pieces they will actually carry, not a mandatory inventory of every
 * gun in the game — and every extra slot is another skin that has to be
 * curated, priced and justified. So this is a deliberately small core, chosen
 * for what people equip rather than for completeness.
 *
 * Phase 13 defines the shape and the candidate pool. The generator itself is
 * Phase 14's job; nothing here decides anything about budgets or prices.
 */
import type { LoadoutSlotConfig } from './loadout';
import { getLoadoutSlot } from './loadout';

/**
 * A core entry: one thing to equip, which may have alternatives.
 *
 * `USP-S` and `P2000` are the same slot in a real loadout, as are `M4A1-S` and
 * `M4A4` — a player carries one, never both. Representing them as separate
 * required slots would generate a loadout nobody could actually use, so they
 * are alternatives within one entry and the generator picks one.
 */
export type SmartCoreEntry = {
	id: string;
	label: string;
	/** Builder slot ids, best-known first. One of these gets filled. */
	slotIds: string[];
	/**
	 * Whether a generated loadout must include this.
	 *
	 * Knives and gloves are optional because they can cost more than every gun
	 * combined — a generator that always included them would answer a budget
	 * question nobody asked. Phase 14 turns these into preferences.
	 */
	optional: boolean;
};

export const SMART_CORE: readonly SmartCoreEntry[] = [
	{ id: 'knife', label: 'Knife', slotIds: ['knife'], optional: true },
	{ id: 'gloves', label: 'Gloves', slotIds: ['gloves'], optional: true },

	// T side.
	{ id: 't-pistol', label: 'Glock-18', slotIds: ['glock-18'], optional: false },
	{ id: 't-rifle', label: 'AK-47', slotIds: ['ak-47'], optional: false },

	// CT side — one starting pistol, one primary rifle.
	{ id: 'ct-pistol', label: 'CT pistol', slotIds: ['usp-s', 'p2000'], optional: false },
	{ id: 'ct-rifle', label: 'CT rifle', slotIds: ['m4a1-s', 'm4a4'], optional: false },

	// Shared.
	{ id: 'deagle', label: 'Desert Eagle', slotIds: ['desert-eagle'], optional: false },
	{ id: 'awp', label: 'AWP', slotIds: ['awp'], optional: false }
] as const;

const entriesById = new Map(SMART_CORE.map((entry) => [entry.id, entry]));

export function getSmartCoreEntry(id: string): SmartCoreEntry | undefined {
	return entriesById.get(id);
}

/** Every builder slot the core can draw from, in core order. */
export function smartCoreSlotIds(): string[] {
	return SMART_CORE.flatMap((entry) => entry.slotIds);
}

/** The builder slots behind one core entry, skipping any that went missing. */
export function smartCoreSlots(entry: SmartCoreEntry): LoadoutSlotConfig[] {
	return entry.slotIds
		.map((slotId) => getLoadoutSlot(slotId))
		.filter((slot): slot is LoadoutSlotConfig => Boolean(slot));
}
