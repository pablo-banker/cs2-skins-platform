/**
 * The kit catalog.
 *
 * Editorial data joined to the cached catalog index — **no market requests**.
 * A page of kits costs nothing at the price API, and it must stay that way.
 */
import { error } from '@sveltejs/kit';
import { getResolvedKits } from '$lib/server/services/kits';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		return { kits: await getResolvedKits({ fetch }) };
	} catch (cause) {
		// Kits are nothing without the skins they name, so a catalog outage is
		// route-level here.
		if (cause instanceof CS2CapError) error(503, 'The catalog is temporarily unavailable');
		throw cause;
	}
};
