/**
 * Turning saved identities into something renderable.
 *
 * ```text
 * canonical identities (slug + exact variant)
 *        ↓  catalog, per item, tolerant
 *   resolved variants            rejected entries
 *        ↓
 *   ONE multi-item price request
 *        ↓
 *   current lowest ask per item
 * ```
 *
 * **Tolerant, like builder restoration.** A wishlist can be a year old; a
 * catalog change that removed one exterior must cost that one entry, not the
 * other forty-nine. So each item is judged on its own and the failures come
 * back listed rather than thrown.
 *
 * **No history, ever.** Thirty candles per item for fifty items would be fifty
 * metered requests to draw charts nobody asked for. The wishlist compares a
 * saved snapshot against one current price, which is what it is for.
 */
import { getSkinBySlug } from './catalog';
import { getManySkinPrices, getMarketProviders } from './market';
import { resolveVariant, variantEdition } from '$lib/features/skins/variant-selection';
import { wishlistItemKey } from '$lib/features/wishlist/identity';
import { isUsableQuote } from '$lib/features/kits/pricing';
import type { WishlistIdentity } from '$lib/schemas/wishlist';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { SkinVariant } from '$lib/types/skin';
import type {
	RejectedWishlistItem,
	ResolvedWishlistItem,
	WishlistResolution
} from '$lib/types/wishlist';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

/** Cheapest quote that may be shown. Stale and non-positive are excluded. */
function cheapestUsable(prices: SkinMarketPrices | null | undefined): MarketQuote | undefined {
	if (!prices) return undefined;

	return prices.quotes
		.filter(isUsableQuote)
		.sort((a, b) => a.priceMinor - b.priceMinor || a.providerId.localeCompare(b.providerId))[0];
}

type Found = {
	key: string;
	skin: Awaited<ReturnType<typeof getSkinBySlug>> & object;
	variant: SkinVariant;
};

/**
 * Resolves the saved list against the catalog and the market.
 *
 * Order matters: everything is resolved first, then priced in one request.
 * Resolving inside the price loop would turn a fifty-item wishlist into fifty
 * round trips.
 */
export async function resolveWishlist(
	identities: readonly WishlistIdentity[],
	options: Cs2CapRequestOptions = {}
): Promise<WishlistResolution> {
	const found: Found[] = [];
	const rejected: RejectedWishlistItem[] = [];

	for (const identity of identities) {
		const key = wishlistItemKey(identity);
		const skin = await getSkinBySlug(identity.skinSlug, options);

		if (!skin) {
			rejected.push({ key, skinSlug: identity.skinSlug, reason: 'unknown-skin' });
			continue;
		}

		const variant = resolveVariant(skin, identity.variant);

		// `resolveVariant` falls back by design. A wishlist entry is an exact
		// choice somebody made, so an unmet one is rejected rather than
		// quietly becoming a different exterior at a different price — the
		// same promise the builder and editorial kits make.
		const { wear, phase, edition } = identity.variant;
		const unmet =
			!variant ||
			(wear && variant.wear !== wear) ||
			(phase && variant.phase !== phase) ||
			(edition && variantEdition(variant) !== edition);

		if (unmet || !variant) {
			rejected.push({ key, skinSlug: identity.skinSlug, reason: 'invalid-variant' });
			continue;
		}

		found.push({ key, skin, variant });
	}

	if (found.length === 0) return { items: [], rejected };

	// ---- Market: one request for everything that resolved --------------------
	const itemIds = [...new Set(found.map((entry) => entry.variant.itemId))];

	// Prices are what the page is for, but losing them must not lose the list.
	// Each side fails on its own.
	const [priceResults, providers] = await Promise.all([
		getManySkinPrices(itemIds, options).catch(
			(): Awaited<ReturnType<typeof getManySkinPrices>> => []
		),
		getMarketProviders(options).catch((): Awaited<ReturnType<typeof getMarketProviders>> => [])
	]);

	const resultByItemId = new Map(priceResults.map((result) => [result.itemId, result]));
	const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));

	const items: ResolvedWishlistItem[] = found.map(({ key, skin, variant }) => {
		const result = resultByItemId.get(variant.itemId);
		const quote = cheapestUsable(result?.prices);

		// Three distinct outcomes, kept distinct: a price, nothing currently
		// listed, and the market not answering at all.
		const priceState =
			!result || result.state === 'error' ? 'error' : quote ? 'priced' : 'unpriced';

		return {
			key,
			skinSlug: skin.id,
			weapon: skin.weapon,
			name: skin.name,
			fullName: skin.fullName,
			imageUrl: variant.imageUrl ?? skin.imageUrl,
			rarity: skin.rarity,
			// Echoed from the catalog, not from the request: the variant that
			// was actually confirmed is the one the card should link to.
			variant: {
				wear: variant.wear,
				edition: variantEdition(variant),
				phase: variant.phase
			},
			priceState,
			currentPriceMinor: quote?.priceMinor,
			currency: quote?.currency,
			providerId: quote?.providerId,
			providerName: quote ? providerNames.get(quote.providerId) : undefined
		};
	});

	return { items, rejected };
}
