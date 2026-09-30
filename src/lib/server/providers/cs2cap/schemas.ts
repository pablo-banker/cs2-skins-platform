/**
 * Zod schemas for CS2Cap responses.
 *
 * Every payload crossing the network is parsed through one of these before it
 * reaches a mapper. A TypeScript interface is a promise; this is a check.
 *
 * Schemas model only the fields we consume — Zod strips the rest — plus the
 * structure needed to reach them safely. Field names here are CS2Cap's and are
 * the only place in the codebase allowed to use them.
 */
import { z } from 'zod';

/** CS2Cap's uniform error envelope: `{ code, detail }`. */
export const cs2capErrorSchema = z.object({
	code: z.string().optional(),
	// 422 responses return an array of field errors rather than a string.
	detail: z.union([z.string(), z.array(z.unknown()), z.null()]).optional()
});

/** One catalog entry. Upstream, each exterior/StatTrak/Souvenir is its own entry. */
export const cs2capItemSchema = z.object({
	item_id: z.number().int().nullish(),
	market_hash_name: z.string(),
	phase: z.string().nullish(),
	item_type: z.string().nullish(),
	item_subtype: z.string().nullish(),
	weapon_type: z.string().nullish(),
	base_name: z.string().nullish(),
	skin_name: z.string().nullish(),
	wear_name: z.string().nullish(),
	collection: z.string().nullish(),
	rarity_name: z.string().nullish(),
	rarity_color: z.string().nullish(),
	is_stattrak: z.boolean().nullish(),
	is_souvenir: z.boolean().nullish(),
	min_float: z.number().nullish(),
	max_float: z.number().nullish(),
	image_url: z.string().nullish()
});

export type Cs2CapItem = z.infer<typeof cs2capItemSchema>;

const cs2capPaginationSchema = z.object({
	limit: z.number().int(),
	offset: z.number().int(),
	total: z.number().int(),
	has_next: z.boolean(),
	has_prev: z.boolean()
});

export const cs2capItemsResponseSchema = z.object({
	items: z.array(cs2capItemSchema),
	pagination: cs2capPaginationSchema
});

export const cs2capItemsMetadataSchema = z.object({
	catalog: z.object({ total_items: z.number().int() }),
	filters: z.object({
		item_type: z.array(z.string()),
		item_subtype: z.array(z.string()),
		weapon_type: z.array(z.string()),
		wear_name: z.array(z.string()),
		phase: z.array(z.string()),
		collection: z.array(z.string()),
		rarity_name: z.array(z.string()),
		style_name: z.array(z.string())
	})
});

/** One provider entry. The response maps display name → this object. */
export const cs2capProviderInfoSchema = z.object({
	key: z.string(),
	logo: z.string().nullish(),
	market_type: z.string().nullish(),
	health: z.object({
		status: z.string(),
		last_checked_at: z.string().nullish()
	})
});

export type Cs2CapProviderInfo = z.infer<typeof cs2capProviderInfoSchema>;

/** `GET /providers` is keyed by provider display name. */
export const cs2capProvidersResponseSchema = z.record(z.string(), cs2capProviderInfoSchema);

/**
 * One provider's lowest ask for one item.
 *
 * `lowest_ask` is in minor units of the response currency, which lives on
 * `meta.currency` rather than on the row.
 */
export const cs2capMarketItemSchema = z.object({
	provider: z.string(),
	item_id: z.number().int(),
	market_hash_name: z.string(),
	lowest_ask: z.number().int(),
	quantity: z.number().int(),
	/** Tracked redirect through the CS2Cap domain. Present on every tier. */
	link: z.string().nullish(),
	last_updated: z.string().nullish(),
	timestamp: z.string().nullish(),
	stale: z.boolean()
});

export type Cs2CapMarketItem = z.infer<typeof cs2capMarketItemSchema>;

export const cs2capPricesResponseSchema = z.object({
	meta: z.object({
		currency: z.string(),
		providers_queried: z.array(z.string())
	}),
	items: z.array(cs2capMarketItemSchema),
	pagination: cs2capPaginationSchema
});

/**
 * One provider's quote inside a batch response.
 *
 * Deliberately **not** the same shape as `cs2capMarketItemSchema`: the batch
 * payload groups quotes under their item, so a quote carries no `item_id`, and
 * — per the published contract — it carries no `link` either. Batch quotes
 * therefore reach the application without a tracked redirect. See
 * docs/PROVIDERS.md.
 */
export const cs2capBatchQuoteSchema = z.object({
	provider: z.string(),
	lowest_ask: z.number().int(),
	quantity: z.number().int(),
	last_updated: z.string().nullish(),
	timestamp: z.string().nullish(),
	stale: z.boolean().default(false)
});

export type Cs2CapBatchQuote = z.infer<typeof cs2capBatchQuoteSchema>;

export const cs2capBatchPriceItemSchema = z.object({
	item_id: z.number().int(),
	market_hash_name: z.string(),
	phase: z.string().nullish(),
	quotes: z.array(cs2capBatchQuoteSchema)
});

export const cs2capBatchPricesResponseSchema = z.object({
	meta: z.object({
		currency: z.string(),
		requested_item_count: z.number().int(),
		found_item_count: z.number().int(),
		providers_queried: z.array(z.string()),
		generated_at: z.string()
	}),
	items: z.array(cs2capBatchPriceItemSchema),
	/** Item ids upstream had no usable price data for. */
	items_not_found: z.array(z.number().int()),
	names_not_found: z.array(z.string()).nullish()
});

/** One OHLCV bucket. `t` is unix seconds; o/h/l/c are minor units. */
export const cs2capCandleSchema = z.object({
	t: z.number().int(),
	o: z.number().int(),
	h: z.number().int(),
	l: z.number().int(),
	c: z.number().int(),
	v: z.number().int().nullish(),
	q: z.number().int().nullish()
});

export const cs2capCandlesResponseSchema = z.object({
	meta: z.object({
		item_id: z.number().int(),
		market_hash_name: z.string(),
		currency: z.string(),
		interval: z.string(),
		start: z.string(),
		end: z.string()
	}),
	data: z.array(cs2capCandleSchema)
});

export type Cs2CapCandlesResponse = z.infer<typeof cs2capCandlesResponseSchema>;
