/**
 * CS2Cap price history (`GET /prices/candles`).
 *
 * The series is composite — each bucket is aggregated across providers, not
 * one marketplace's own history. Per-provider history is a paid-tier endpoint
 * and is out of scope.
 */
import type { PriceHistory } from '$lib/types/price-history';
import { CS2CAP_DEFAULT_CURRENCY, requestCs2Cap, type Cs2CapRequestOptions } from './client';
import { toPriceHistory } from './mappers';
import { cs2capCandlesResponseSchema } from './schemas';

/**
 * Daily buckets over 30 days.
 *
 * This is the window the free and starter tiers allow: `interval=1d` and a
 * lookback of at most 30 whole days. Asking for more returns 403 rather than a
 * truncated series, so the defaults stay inside the plan.
 */
export const DEFAULT_HISTORY_INTERVAL = '1d';
export const DEFAULT_HISTORY_LOOKBACK_DAYS = 30;

export type GetPriceHistoryParams = {
	itemId: number;
	/** Whole days to look back. Capped at 30 by the current plan. */
	lookbackDays?: number;
	/** Bucket size. `1d` is the only interval the current plan allows. */
	interval?: string;
	currency?: string;
};

export async function getPriceHistory(
	params: GetPriceHistoryParams,
	options: Cs2CapRequestOptions = {}
): Promise<PriceHistory> {
	const lookbackDays = Math.min(
		params.lookbackDays ?? DEFAULT_HISTORY_LOOKBACK_DAYS,
		DEFAULT_HISTORY_LOOKBACK_DAYS
	);

	const response = await requestCs2Cap(
		'/prices/candles',
		{
			schema: cs2capCandlesResponseSchema,
			query: {
				item_id: params.itemId,
				lookback: `${lookbackDays}d`,
				interval: params.interval ?? DEFAULT_HISTORY_INTERVAL,
				currency: params.currency ?? CS2CAP_DEFAULT_CURRENCY
			}
		},
		options
	);

	return toPriceHistory(response);
}
