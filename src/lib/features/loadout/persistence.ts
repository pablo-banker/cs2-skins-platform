/**
 * Keeping the current loadout on this device.
 *
 * **A convenience, not a feature the product depends on.** `localStorage` can
 * be absent, disabled, full, or hold something a previous build wrote — so
 * every operation here is total. Nothing throws, nothing propagates, and a
 * browser that refuses to store anything still gets a working builder for the
 * session. Losing a save is a disappointment; a blank page is a bug.
 *
 * Safe to import during SSR: `localStorage` is touched inside functions, never
 * at module scope, so loading this on the server does nothing at all.
 */
import {
	BUILDER_STORAGE_KEY,
	persistedLoadoutSchema,
	PERSISTED_LOADOUT_VERSION
} from '$lib/schemas/loadout-persistence';
import type { LoadoutSelection } from '$lib/types/loadout';

/**
 * The store, if there is one.
 *
 * Reading `localStorage` can itself throw — Safari does exactly that with site
 * data blocked — so even getting hold of it is guarded.
 */
function storage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

/**
 * What was saved on this device, if anything usable was.
 *
 * Anything unreadable — absent, corrupt, a version we do not understand, a
 * shape that fails validation — comes back as nothing. Deliberately quiet:
 * there is no recovery a visitor could perform, and the builder simply starts
 * empty.
 */
export function readPersistedLoadout(): LoadoutSelection[] | undefined {
	const store = storage();
	if (!store) return undefined;

	let raw: string | null;

	try {
		raw = store.getItem(BUILDER_STORAGE_KEY);
	} catch {
		return undefined;
	}

	if (!raw) return undefined;

	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}

	const result = persistedLoadoutSchema.safeParse(parsed);

	return result.success ? result.data.selections : undefined;
}

/**
 * Saves the current selections, or removes the key when there is nothing to
 * save.
 *
 * An empty loadout is stored as **no key** rather than as an empty list. The
 * two are indistinguishable when read back, and leaving a record behind for a
 * builder someone emptied is tidier in the code and untidier on their machine.
 *
 * Returns whether it worked, so a caller that cares can tell — though the only
 * caller does not, because there is nothing useful to do about it.
 */
export function writePersistedLoadout(selections: readonly LoadoutSelection[]): boolean {
	const store = storage();
	if (!store) return false;

	try {
		if (selections.length === 0) {
			store.removeItem(BUILDER_STORAGE_KEY);
			return true;
		}

		store.setItem(
			BUILDER_STORAGE_KEY,
			JSON.stringify({ version: PERSISTED_LOADOUT_VERSION, selections })
		);

		return true;
	} catch {
		// Quota exceeded, private mode, storage disabled mid-session. The
		// builder keeps working; only the save is lost.
		return false;
	}
}

export function clearPersistedLoadout(): void {
	writePersistedLoadout([]);
}
