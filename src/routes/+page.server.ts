/**
 * The homepage.
 *
 * Loads **one thing**: a few editorial kits to preview. No prices, no
 * providers, no history — a cold visit to the front door must not spend a
 * metered request, and a test enforces that this file imports no market
 * service.
 *
 * Everything else the page shows is static product copy and links to the
 * features that do the work.
 */
import { getResolvedKits } from '$lib/server/services/kits';
import type { ResolvedKit } from '$lib/types/kit';
import type { PageServerLoad } from './$types';

/**
 * How many kits the preview shows.
 *
 * Three fits one desktop row and reads as a sample rather than a catalog —
 * `/kits` is one link away and has all of them.
 *
 * Not exported: SvelteKit only allows `load` and its siblings out of a
 * `+page.server.ts`, and the tests assert the behaviour rather than the
 * number.
 */
const KIT_PREVIEW_COUNT = 3;

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		// Editorial order is the product's order; the first few are the first
		// few on `/kits` too. No `featured` flag exists and none is wanted.
		const kits = (await getResolvedKits({ fetch })).slice(0, KIT_PREVIEW_COUNT);

		return { kits };
	} catch {
		// A secondary section. If the catalog is down, the homepage still has
		// to explain the product and link to everything else — a preview
		// failing is not a reason to 500 the front door.
		const kits: ResolvedKit[] = [];

		return { kits };
	}
};
