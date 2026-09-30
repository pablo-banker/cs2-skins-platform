/**
 * Translation from CS2Cap payloads into our own domain types.
 *
 * This is the boundary: CS2Cap field names (`lowest_ask`, `market_hash_name`,
 * `is_stattrak`, `rarity_color`) exist on the way in and never on the way out.
 * Everything here is pure — no fetching, no environment, no side effects — so
 * it is cheap to test and safe to reuse.
 */
import type { CatalogFilters, Skin, SkinRarity, SkinVariant } from '$lib/types/skin';
import type { MarketProvider, MarketProviderStatus } from '$lib/types/provider';
import type { MarketQuote } from '$lib/types/market';
import type { PriceHistory, PriceHistoryPoint } from '$lib/types/price-history';
import type { z } from 'zod';
import type {
	Cs2CapBatchQuote,
	Cs2CapCandlesResponse,
	Cs2CapItem,
	Cs2CapMarketItem,
	Cs2CapProviderInfo,
	cs2capItemsMetadataSchema
} from './schemas';

/** Drops `null` so optional domain fields stay genuinely absent. */
function optional<T>(value: T | null | undefined): T | undefined {
	return value ?? undefined;
}

/**
 * `ak-47-redline`, for `/skins/[slug]`.
 *
 * Deliberately lossy: it is a URL label, never an identity. Prices are always
 * keyed on `itemId`.
 */
export function toSkinSlug(weapon: string, name: string): string {
	return `${weapon} ${name}`
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Upstream gives a bare hex (`eb4b4b`) or a colour alias (`red`). Only a real
 * hex becomes a usable colour; anything else is dropped rather than guessed,
 * because rarity still reads correctly from its name.
 */
function toRarityColor(value: string | null | undefined): string | undefined {
	if (!value) return undefined;

	const hex = value.startsWith('#') ? value.slice(1) : value;
	return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : undefined;
}

function toRarity(item: Cs2CapItem): SkinRarity | undefined {
	if (!item.rarity_name) return undefined;

	const color = toRarityColor(item.rarity_color);
	return color ? { name: item.rarity_name, color } : { name: item.rarity_name };
}

/**
 * One catalog entry becomes one buyable variant.
 *
 * Entries without an `item_id` are unusable: every price and history lookup is
 * keyed on it, so they are filtered out upstream of this function.
 */
export function toSkinVariant(item: Cs2CapItem & { item_id: number }): SkinVariant {
	return {
		itemId: item.item_id,
		marketHashName: item.market_hash_name,
		wear: optional(item.wear_name),
		statTrak: item.is_stattrak === true,
		souvenir: item.is_souvenir === true,
		phase: optional(item.phase),
		minFloat: optional(item.min_float),
		maxFloat: optional(item.max_float),
		imageUrl: optional(item.image_url)
	};
}

/**
 * The grouping key for a product-level skin.
 *
 * `base_name` + `skin_name` deliberately collapses exterior, StatTrak and
 * Souvenir — those are variant dimensions, and each stays its own variant with
 * its own `itemId`. Entries without both parts (crates, stickers, agents) are
 * not skins, so each becomes its own single-variant group keyed by its name.
 */
function groupKey(item: Cs2CapItem): string {
	// A finish-less entry is still a product: a vanilla knife has no skin name,
	// and its plain and StatTrak rows are two variants of one item rather than
	// two items. Keying those on the market hash name would split them, because
	// only that string carries the "StatTrak™" marker.
	if (item.base_name) {
		return `${item.base_name}\u0000${item.skin_name ?? ''}`;
	}

	// Nothing to group by but the full name. Rare, and not something to invent
	// an identity for.
	return `\u0001${item.market_hash_name}`;
}

/**
 * Groups catalog entries into product-level skins.
 *
 * ```text
 * AK-47 | Redline (Factory New)     ┐
 * AK-47 | Redline (Minimal Wear)    ├─► AK-47 | Redline  { variants: [...] }
 * StatTrak™ AK-47 | Redline (FT)    ┘
 * ```
 *
 * Grouping is scoped to the entries handed in. A paginated search can
 * therefore return a skin whose variants continue on the next page — fetch by
 * base/skin name when a complete variant set matters.
 */
export function groupItemsIntoSkins(items: Cs2CapItem[]): Skin[] {
	const groups = new Map<string, Skin>();

	for (const item of items) {
		// No catalog id means no way to price it; such an entry is not useful.
		if (item.item_id === null || item.item_id === undefined) continue;

		const key = groupKey(item);
		const variant = toSkinVariant({ ...item, item_id: item.item_id });
		const existing = groups.get(key);

		if (existing) {
			existing.variants.push(variant);

			// Later entries fill gaps the first one left, without overwriting it.
			existing.imageUrl ??= optional(item.image_url);
			existing.rarity ??= toRarity(item);
			existing.collection ??= optional(item.collection);
			existing.weaponType ??= optional(item.weapon_type);
			existing.itemSubtype ??= optional(item.item_subtype);
			continue;
		}

		const weapon = item.base_name ?? item.market_hash_name;
		const name = item.skin_name ?? '';

		groups.set(key, {
			id: toSkinSlug(weapon, name),
			weapon,
			name,
			fullName: name ? `${weapon} | ${name}` : weapon,
			imageUrl: optional(item.image_url),
			rarity: toRarity(item),
			collection: optional(item.collection),
			weaponType: optional(item.weapon_type),
			itemSubtype: optional(item.item_subtype),
			variants: [variant]
		});
	}

	return [...groups.values()];
}

/**
 * One provider row.
 *
 * The response is keyed by display name, with the stable key inside the value,
 * so both halves are needed to build a provider.
 */
export function toMarketProvider(displayName: string, info: Cs2CapProviderInfo): MarketProvider {
	return {
		id: info.key,
		name: displayName,
		logoUrl: optional(info.logo),
		marketType: optional(info.market_type),
		status: toProviderStatus(info.health.status),
		lastCheckedAt: optional(info.health.last_checked_at)
	};
}

function toProviderStatus(status: string): MarketProviderStatus {
	switch (status.toLowerCase()) {
		case 'up':
		case 'ok':
		case 'healthy':
			return 'up';
		case 'degraded':
		case 'partial':
			return 'degraded';
		case 'down':
		case 'error':
			return 'down';
		default:
			return 'unknown';
	}
}

/**
 * One provider's lowest ask.
 *
 * `lowest_ask` arrives as an integer in minor units and stays one: no division,
 * no float, no rounding. The currency comes from the response meta, since the
 * row itself does not carry it.
 */
export function toMarketQuote(item: Cs2CapMarketItem, currency: string): MarketQuote {
	return {
		providerId: item.provider,
		itemId: item.item_id,
		priceMinor: item.lowest_ask,
		currency,
		quantity: item.quantity,
		updatedAt: optional(item.last_updated) ?? optional(item.timestamp),
		stale: item.stale,
		redirectUrl: optional(item.link)
	};
}

/** Cheapest first, then most listings — the order a comparison table wants. */
/**
 * A batch quote, in the same domain shape as an individual one.
 *
 * The batch payload nests quotes under their item, so `itemId` is supplied by
 * the caller rather than read from the row. The published batch contract has
 * no `link` field, so a batch quote reaches the application with no
 * `redirectUrl` — the one behavioural difference between the two transports,
 * and the reason the UI must treat a missing redirect as normal.
 */
export function toBatchMarketQuote(
	quote: Cs2CapBatchQuote,
	itemId: number,
	currency: string
): MarketQuote {
	return {
		providerId: quote.provider,
		itemId,
		priceMinor: quote.lowest_ask,
		currency,
		quantity: quote.quantity,
		updatedAt: optional(quote.last_updated) ?? optional(quote.timestamp),
		stale: quote.stale
	};
}

export function sortQuotesByPrice(quotes: MarketQuote[]): MarketQuote[] {
	return [...quotes].sort((a, b) => a.priceMinor - b.priceMinor || b.quantity - a.quantity);
}

/** Unix seconds (UTC) → ISO 8601, matching every other timestamp we expose. */
function toIsoTimestamp(unixSeconds: number): string {
	return new Date(unixSeconds * 1000).toISOString();
}

export function toPriceHistoryPoint(
	candle: Cs2CapCandlesResponse['data'][number]
): PriceHistoryPoint {
	return {
		timestamp: toIsoTimestamp(candle.t),
		open: candle.o,
		high: candle.h,
		low: candle.l,
		close: candle.c,
		volume: optional(candle.v),
		listings: optional(candle.q)
	};
}

export function toPriceHistory(response: Cs2CapCandlesResponse): PriceHistory {
	return {
		itemId: response.meta.item_id,
		currency: response.meta.currency,
		interval: response.meta.interval,
		start: response.meta.start,
		end: response.meta.end,
		// Oldest first, so a chart can consume the series directly.
		points: response.data
			.map(toPriceHistoryPoint)
			.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
	};
}

export function toCatalogFilters(
	response: z.infer<typeof cs2capItemsMetadataSchema>
): CatalogFilters {
	const { catalog, filters } = response;

	return {
		totalItems: catalog.total_items,
		itemTypes: filters.item_type,
		itemSubtypes: filters.item_subtype,
		weaponTypes: filters.weapon_type,
		wears: filters.wear_name,
		phases: filters.phase,
		collections: filters.collection,
		rarities: filters.rarity_name,
		styles: filters.style_name
	};
}
