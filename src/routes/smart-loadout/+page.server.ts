/**
 * The Smart Loadout form.
 *
 * Sends the Smart Core and the preferences that can currently produce a
 * complete loadout — computed from the curated dataset, so an option that
 * cannot possibly work is never offered and nobody spends a generation
 * discovering that.
 *
 * The curated dataset itself stays on the server. No market request happens
 * here: prices are loaded when someone presses Generate.
 */
import { SMART_CORE } from '$lib/config/smart-loadout';
import { getSmartAvailability } from '$lib/server/services/smart-loadout';
import { getVisualTaxonomy } from '$lib/server/services/visual-metadata';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const availability = await getSmartAvailability({ fetch });
	const taxonomy = getVisualTaxonomy();

	return {
		availability,
		// Labels come from the shared taxonomy, so a colour reads the same here
		// as anywhere else it is named.
		colorLabels: Object.fromEntries(taxonomy.colors.map((entry) => [entry.id, entry.label])),
		styleLabels: Object.fromEntries(taxonomy.styles.map((entry) => [entry.id, entry.label])),
		core: SMART_CORE.map((entry) => ({
			id: entry.id,
			label: entry.label,
			optional: entry.optional
		}))
	};
};
