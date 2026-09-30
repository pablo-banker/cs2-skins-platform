/**
 * Slicing and summarising a price history series.
 *
 * Pure, and everything stays in integer minor units — the conversion to a
 * readable amount happens once, in the formatter, at render time.
 */
import type { PriceHistoryPoint } from '$lib/types/price-history';

/** The windows offered. Both are served from one 30-day fetch. */
export const HISTORY_RANGES = [7, 30] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number];

/**
 * The last `days` points of a series.
 *
 * A subset, not a second request: the page already holds 30 daily candles, so
 * switching to 7 days is a slice rather than a round trip.
 */
export function historyRange(
	points: readonly PriceHistoryPoint[],
	days: HistoryRange
): PriceHistoryPoint[] {
	return points.slice(-days);
}

export type HistorySummary = {
	/** Most recent close, in minor units. */
	current: number;
	low: number;
	high: number;
	/** Change from the first close in the window, in minor units. */
	change: number;
	/** Change as a fraction of the first close, or `null` when it was zero. */
	changeRatio: number | null;
};

/**
 * The headline numbers for a window.
 *
 * Deliberately factual: where the price is now, how far it moved, how low and
 * high it went. Nothing here is a return, a yield or a recommendation — this
 * is a price chart for someone buying a skin, not a position.
 */
export function summariseHistory(points: readonly PriceHistoryPoint[]): HistorySummary | null {
	if (points.length === 0) return null;

	const first = points[0];
	const last = points[points.length - 1];
	const change = last.close - first.close;

	// Computed from closes, the same series the chart draws. The candles also
	// carry each day's intraday low and high, but quoting those beside a line
	// of closes puts a number on screen the chart visibly contradicts.
	const closes = points.map((point) => point.close);

	return {
		current: last.close,
		low: Math.min(...closes),
		high: Math.max(...closes),
		change,
		changeRatio: first.close === 0 ? null : change / first.close
	};
}
