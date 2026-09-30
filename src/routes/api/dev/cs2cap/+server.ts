/**
 * Development-only diagnostic for the server data layer.
 *
 * It proves the whole path works — application service → cache → CS2Cap
 * integration → API — using nothing but our normalized types, and it exercises
 * the cache twice so a hit is visible in the stats. It is not a product
 * endpoint: it returns 404 outside `dev`, and no UI consumes it.
 *
 * `GET /api/dev/cs2cap?q=AK-47 | Redline`
 */
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import { serverCache } from '$lib/server/cache/ttl-cache';
import { browseSkins, getSkinDetail } from '$lib/server/services/catalog';
import {
	getMarketProviders,
	getSkinPriceHistory,
	getSkinPrices
} from '$lib/server/services/market';
import type { SkinVariant } from '$lib/types/skin';
import type { RequestHandler } from './$types';

const DEFAULT_QUERY = 'AK-47 | Redline';

/** Prefers a plain Field-Tested variant — the one a price page opens on. */
function pickVariant(variants: SkinVariant[]): SkinVariant | undefined {
	return (
		variants.find((v) => v.wear === 'Field-Tested' && !v.statTrak && !v.souvenir) ??
		variants.find((v) => !v.statTrak && !v.souvenir) ??
		variants[0]
	);
}

/** Shapes a failure into something safe to read. Never includes the key. */
function describeFailure(cause: unknown): { kind: string; code?: string; message: string } {
	if (cause instanceof CS2CapError) {
		return { kind: cause.kind, code: cause.code, message: cause.message };
	}

	return { kind: 'unknown', message: cause instanceof Error ? cause.message : 'Unknown failure' };
}

const httpStatusByKind: Record<string, number> = {
	config: 500,
	auth: 502,
	forbidden: 502,
	not_found: 404,
	rate_limit: 429,
	unavailable: 503,
	invalid_response: 502,
	upstream: 502
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	if (!dev) error(404, 'Not found');

	const query = url.searchParams.get('q')?.trim() || DEFAULT_QUERY;
	const before = serverCache.stats();

	try {
		const search = await browseSkins(
			{
				q: query,
				sort: 'relevance',
				page: 1,
				stattrak: undefined,
				souvenir: undefined,
				weapon: undefined,
				weaponType: undefined,
				wear: undefined,
				rarity: undefined,
				collection: undefined
			},
			{ fetch }
		);
		const match = search.skins[0];

		if (!match) {
			return json({ query, matchedSkins: 0, message: 'No catalog match for that query.' });
		}

		// Search results may carry a partial variant set; the detail path is the
		// one that guarantees a complete one.
		const skin =
			(await getSkinDetail({ weapon: match.weapon, name: match.name }, { fetch })) ?? match;

		const variant = pickVariant(skin.variants);
		if (!variant) error(404, 'Matched a skin with no priceable variant');

		const prices = await getSkinPrices(variant.itemId, { fetch });

		// Repeating a call proves the cache serves the second one without a
		// second upstream request.
		const cachedPrices = await getSkinPrices(variant.itemId, { fetch });

		// History and the provider directory are nice-to-have here: a plan limit
		// on either should not hide a working catalog and price path.
		const history = await getSkinPriceHistory(variant.itemId, { fetch }).catch((cause: unknown) =>
			describeFailure(cause)
		);
		const providers = await getMarketProviders({ fetch }).catch((cause: unknown) =>
			describeFailure(cause)
		);

		const quotedProviderIds = new Set(prices.quotes.map((quote) => quote.providerId));
		const after = serverCache.stats();

		return json({
			query,
			matchedSkins: search.skins.length,
			totalCatalogMatches: search.total,
			skin: {
				id: skin.id,
				fullName: skin.fullName,
				weapon: skin.weapon,
				name: skin.name,
				weaponType: skin.weaponType,
				collection: skin.collection,
				rarity: skin.rarity,
				imageUrl: skin.imageUrl,
				variantCount: skin.variants.length,
				variants: skin.variants.map((v) => ({
					itemId: v.itemId,
					marketHashName: v.marketHashName,
					wear: v.wear,
					statTrak: v.statTrak,
					souvenir: v.souvenir,
					phase: v.phase
				}))
			},
			selectedVariant: {
				itemId: variant.itemId,
				marketHashName: variant.marketHashName,
				wear: variant.wear,
				statTrak: variant.statTrak,
				souvenir: variant.souvenir
			},
			prices: {
				currency: prices.currency,
				providersQueried: prices.providersQueried.length,
				quoteCount: prices.quotes.length,
				// Minor units, cheapest first. 14250 BRL means R$ 142,50.
				bestQuote: prices.bestQuote,
				quotes: prices.quotes.slice(0, 10),
				/** Proof the repeat call was served from cache, not upstream. */
				repeatCallServedFromCache: cachedPrices === prices
			},
			providers: Array.isArray(providers)
				? {
						total: providers.length,
						quotingThisItem: providers
							.filter((provider) => quotedProviderIds.has(provider.id))
							.map((provider) => ({
								id: provider.id,
								name: provider.name,
								status: provider.status,
								marketType: provider.marketType
							}))
					}
				: providers,
			history:
				'points' in history
					? {
							currency: history.currency,
							interval: history.interval,
							start: history.start,
							end: history.end,
							pointCount: history.points.length,
							first: history.points.at(0),
							last: history.points.at(-1)
						}
					: history,
			/**
			 * Counters only — never keys, never cached values. `size` is how many
			 * entries the process holds, not what is in them.
			 */
			cache: {
				hitsThisRequest: after.hits - before.hits,
				missesThisRequest: after.misses - before.misses,
				coalescedThisRequest: after.coalesced - before.coalesced,
				totals: after
			}
		});
	} catch (cause) {
		if (cause instanceof CS2CapError) {
			const failure = describeFailure(cause);
			error(httpStatusByKind[cause.kind] ?? 502, failure.message);
		}

		throw cause;
	}
};
