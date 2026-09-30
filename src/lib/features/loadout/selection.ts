/**
 * Working with a loadout's selections.
 *
 * Pure and serializable. Nothing here knows about Svelte, the network or
 * CS2Cap — which is what will let Phase 12 save and share a loadout without
 * reworking the model.
 */
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import type { Loadout, LoadoutSelection } from '$lib/types/loadout';
import type { SkinSelection } from '$lib/schemas/skin-detail';

export const EMPTY_LOADOUT: Loadout = { selections: [] };

/** Canonical slot order — the registry's order, not the order of clicks. */
const slotOrder = new Map(LOADOUT_SLOTS.map((slot, index) => [slot.id, index]));

function rank(slotId: string): number {
	return slotOrder.get(slotId) ?? LOADOUT_SLOTS.length;
}

/** Selections in registry order, so a loadout always reads the same way. */
export function orderedSelections(loadout: Loadout): LoadoutSelection[] {
	return [...loadout.selections].sort(
		(a, b) => rank(a.slotId) - rank(b.slotId) || a.slotId.localeCompare(b.slotId)
	);
}

export function selectionForSlot(loadout: Loadout, slotId: string): LoadoutSelection | undefined {
	return loadout.selections.find((entry) => entry.slotId === slotId);
}

export function selectionCount(loadout: Loadout): number {
	return loadout.selections.length;
}

export function isEmpty(loadout: Loadout): boolean {
	return loadout.selections.length === 0;
}

/**
 * Puts a skin in a slot, replacing whatever was there.
 *
 * Returns a new loadout rather than mutating: the page holds the old one in
 * `$state`, and an in-place edit would leave the pricing fingerprint comparing
 * an object against itself.
 */
export function selectSkin(
	loadout: Loadout,
	slotId: string,
	skinSlug: string,
	variant: SkinSelection = {}
): Loadout {
	const selection: LoadoutSelection = { slotId, skinSlug, variant: compactVariant(variant) };

	return {
		selections: [...loadout.selections.filter((entry) => entry.slotId !== slotId), selection]
	};
}

/** Empties one slot. Every other slot is untouched. */
export function clearSlot(loadout: Loadout, slotId: string): Loadout {
	return { selections: loadout.selections.filter((entry) => entry.slotId !== slotId) };
}

export function clearLoadout(): Loadout {
	return EMPTY_LOADOUT;
}

/**
 * Drops empty variant fields.
 *
 * `{ wear: undefined }` and `{}` mean the same thing, and two selections that
 * mean the same thing must fingerprint the same way.
 */
function compactVariant(variant: SkinSelection): SkinSelection {
	const compact: SkinSelection = {};

	if (variant.wear) compact.wear = variant.wear;
	if (variant.edition) compact.edition = variant.edition;
	if (variant.phase) compact.phase = variant.phase;

	return compact;
}

/**
 * A stable string for exactly what is selected.
 *
 * This is how the page knows a displayed total still describes what is on
 * screen. Doing it by fingerprint rather than by clearing state from every
 * code path that edits a loadout means a new edit path cannot forget: if the
 * string differs, the prices are stale, whatever changed them.
 *
 * Order-independent — sorted by the registry — so dragging a slot into a
 * different position would not invalidate a perfectly good calculation.
 */
export function loadoutFingerprint(loadout: Loadout): string {
	return orderedSelections(loadout)
		.map((entry) => {
			const { wear = '', edition = '', phase = '' } = entry.variant;

			return `${entry.slotId}:${entry.skinSlug}:${wear}:${edition}:${phase}`;
		})
		.join('|');
}
