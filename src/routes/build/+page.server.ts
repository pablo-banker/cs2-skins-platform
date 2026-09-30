/**
 * The loadout builder's shell, plus any loadout the URL carried.
 *
 * Sends the **slot registry** and nothing else by default. The catalog stays on
 * the server: nearly two thousand skins with every variant attached is
 * megabytes the browser has no use for, and the picker asks for one bounded
 * page at a time instead.
 *
 * A shared link is decoded and resolved **here**, during SSR, so the first
 * render of someone else's loadout is already correct — no blank builder that
 * fills in a moment later, and no trusting a stranger's query parameter on the
 * client.
 *
 * No market request happens in either case. Prices start uncalculated.
 */
import { loadoutSections, LOADOUT_SLOTS } from '$lib/config/loadout';
import { decodeLoadout, SHARE_PARAM } from '$lib/features/loadout/share';
import { resolveSelectionsTolerantly, type LoadoutResolution } from '$lib/server/services/loadout';
import type { PageServerLoad } from './$types';

export type SharedLoadout =
	| { state: 'none' }
	/** Decoded and resolved. May still carry rejected selections. */
	| ({ state: 'loaded' } & LoadoutResolution)
	/** Undecodable, unsupported or oversized. The builder renders empty. */
	| { state: 'invalid' };

async function readShared(
	payload: string | null,
	fetch: typeof globalThis.fetch
): Promise<SharedLoadout> {
	if (!payload) return { state: 'none' };

	const decoded = decodeLoadout(payload);

	// A stranger controls this string. Every failure is a calm empty builder
	// with a note — never a 500, and never a decoder detail on screen.
	if (!decoded.ok) return { state: 'invalid' };

	try {
		const resolution = await resolveSelectionsTolerantly(decoded.selections, { fetch });

		// Structurally fine but nothing in it still exists: from the visitor's
		// side that is the same as a broken link.
		if (resolution.selections.length === 0) return { state: 'invalid' };

		return { state: 'loaded', ...resolution };
	} catch {
		// The catalog is down. The link is probably fine; say the neutral thing.
		return { state: 'invalid' };
	}
}

export const load: PageServerLoad = async ({ url, fetch }) => {
	return {
		sections: loadoutSections(),
		slotCount: LOADOUT_SLOTS.length,
		shared: await readShared(url.searchParams.get(SHARE_PARAM), fetch)
	};
};
