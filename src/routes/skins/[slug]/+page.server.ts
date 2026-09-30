/**
 * Skin details.
 *
 * Server-rendered: the skin's identity is the indexable, shareable part of the
 * product, and prices should be in the first response rather than arriving
 * after a round trip. TanStack Query is deliberately absent — there is no
 * interactive refresh here, so it would add a second data path for nothing.
 *
 * **Only the selected variant's market data is fetched.** A skin has around
 * eleven variants; loading prices for all of them would be eleven upstream
 * requests against a metered API for ten the visitor may never look at.
 */
import { error } from '@sveltejs/kit';
import { parseSkinSelection } from '$lib/schemas/skin-detail';
import { resolveVariant } from '$lib/features/skins/variant-selection';
import { getSkinBySlug } from '$lib/server/services/catalog';
import {
	getMarketProviders,
	getSkinPriceHistory,
	getSkinPrices
} from '$lib/server/services/market';
import { getSkinRecommendations } from '$lib/server/services/recommendations';
import { getVisualProfile } from '$lib/server/services/visual-metadata';
import { equipmentSlot } from '$lib/features/recommendations/knife-gloves';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import type { MarketProvider } from '$lib/types/provider';
import type { SkinRecommendations } from '$lib/server/services/recommendations';
import type { PageServerLoad } from './$types';

/** Recommendations are an extra, so their absence is a state, not an error. */
const NO_RECOMMENDATIONS: SkinRecommendations = { similar: [], matches: [] };

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	let skin;

	try {
		skin = await getSkinBySlug(params.slug, { fetch });
	} catch (cause) {
		// Without the catalog we cannot say what this page is about, so this
		// one failure is route-level.
		if (cause instanceof CS2CapError) error(503, 'The catalog is temporarily unavailable');
		throw cause;
	}

	if (!skin) error(404, 'Skin not found');

	const selection = parseSkinSelection(url.searchParams);
	const variant = resolveVariant(skin, selection);

	if (!variant) error(404, 'This skin has no priceable variant');

	/**
	 * Prices, providers, history and recommendations fail independently.
	 *
	 * A price outage must not take the skin's identity down with it: the
	 * catalog half of the page is still useful, and a visitor who followed a
	 * link deserves to see what they came for. Recommendations are the least
	 * important thing here and are the most willing to disappear — a bug in
	 * scoring must never turn a price comparison into a 500.
	 *
	 * Recommendations sit in this `Promise.all` rather than after it: they make
	 * no market request, but they do read the cached catalog, and there is no
	 * reason to wait for prices first.
	 */
	const [prices, providers, history, recommendations] = await Promise.all([
		getSkinPrices(variant.itemId, { fetch }).catch(() => null),
		getMarketProviders({ fetch }).catch((): MarketProvider[] => []),
		getSkinPriceHistory(variant.itemId, { fetch }).catch(() => null),
		getSkinRecommendations(skin, { fetch }).catch(() => NO_RECOMMENDATIONS)
	]);

	return {
		skin,
		variant,
		selection,
		prices,
		providers,
		history,
		recommendations,
		/**
		 * Whether the Knife + Gloves matcher can do anything with this skin.
		 *
		 * Both halves are required: the right category, and curation to match
		 * on. Offering the link for an uncurated knife would send someone to a
		 * page that can only tell them no.
		 */
		matcherSlot:
			equipmentSlot(skin) && getVisualProfile(skin.weapon, skin.name)
				? equipmentSlot(skin)
				: undefined
	};
};
