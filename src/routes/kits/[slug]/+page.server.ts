/**
 * A single kit, priced.
 *
 * Editorial content, catalog resolution and live market data, in that order of
 * importance: the kit renders even when the market does not answer. Prices are
 * loaded for the **exact variants the kit names**, in one multi-item request,
 * and no history — a kit compares what things cost now.
 */
import { error } from '@sveltejs/kit';
import { getResolvedKitBySlug } from '$lib/server/services/kits';
import { getManySkinPrices, getMarketProviders } from '$lib/server/services/market';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import { kitItemIds } from '$lib/features/kits/pricing';
import type { ResolvedKit } from '$lib/types/kit';
import type { SkinMarketPrices } from '$lib/types/market';
import type { MarketProvider } from '$lib/types/provider';
import type { PageServerLoad } from './$types';

async function resolveKit(
	slug: string,
	fetch: typeof globalThis.fetch
): Promise<ResolvedKit | undefined> {
	try {
		return await getResolvedKitBySlug(slug, { fetch });
	} catch (cause) {
		// Kits are nothing without the skins they name, so a catalog outage is
		// route-level here — unlike a price outage, which is not.
		if (cause instanceof CS2CapError) error(503, 'The catalog is temporarily unavailable');
		throw cause;
	}
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const kit = await resolveKit(params.slug, fetch);

	// An unknown kit is a 404, never a fallback to the first one.
	if (!kit) error(404, 'Kit not found');

	// Prices and the marketplace directory fail independently of each other and
	// of the kit. A missing logo must never cost a total.
	const [priceResults, providers] = await Promise.all([
		getManySkinPrices(kitItemIds(kit), { fetch }),
		getMarketProviders({ fetch }).catch((): MarketProvider[] => [])
	]);

	// Keyed by item id so the page joins prices to the exact variant that was
	// priced, rather than trusting two arrays to stay in step.
	const prices: [number, SkinMarketPrices | null][] = priceResults.map((result) => [
		result.itemId,
		result.prices
	]);

	return { kit, prices, providers };
};
