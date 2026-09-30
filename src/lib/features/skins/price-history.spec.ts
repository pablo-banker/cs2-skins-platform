import { describe, expect, it } from 'vitest';
import { historyRange, summariseHistory, HISTORY_RANGES } from './price-history';
import type { PriceHistoryPoint } from '$lib/types/price-history';

/** `days` daily candles, oldest first, closing at the given values. */
function series(closes: number[]): PriceHistoryPoint[] {
	return closes.map((close, index) => ({
		timestamp: new Date(Date.UTC(2026, 7, 22 + index)).toISOString(),
		open: close,
		high: close + 100,
		low: close - 100,
		close
	}));
}

const thirtyDays = series(Array.from({ length: 30 }, (_, i) => 13000 + i * 10));

describe('historyRange', () => {
	it('offers exactly the two windows one fetch can serve', () => {
		expect(HISTORY_RANGES).toEqual([7, 30]);
	});

	it('returns the whole series for 30 days', () => {
		expect(historyRange(thirtyDays, 30)).toHaveLength(30);
	});

	it('returns the most recent week for 7 days', () => {
		const week = historyRange(thirtyDays, 7);

		expect(week).toHaveLength(7);
		expect(week.at(-1)).toEqual(thirtyDays.at(-1));
		expect(week[0].close).toBe(thirtyDays[23].close);
	});

	it('keeps points oldest to newest', () => {
		const week = historyRange(thirtyDays, 7);
		const timestamps = week.map((point) => point.timestamp);

		expect(timestamps).toEqual([...timestamps].sort());
	});

	it('does not mutate the series', () => {
		const before = thirtyDays.map((point) => point.close);
		historyRange(thirtyDays, 7);

		expect(thirtyDays.map((point) => point.close)).toEqual(before);
	});

	it('copes with fewer points than the window', () => {
		expect(historyRange(series([100, 200]), 30)).toHaveLength(2);
	});
});

describe('summariseHistory', () => {
	it('reports the latest close, the range and the change', () => {
		const summary = summariseHistory(series([13000, 13500, 12800, 13100]))!;

		expect(summary.current).toBe(13100);
		expect(summary.low).toBe(12800);
		expect(summary.high).toBe(13500);
		expect(summary.change).toBe(100);
	});

	it('describes the plotted closes, not the intraday extremes', () => {
		// The chart draws closes; quoting a low the line never reaches would
		// put a number on screen the picture contradicts.
		const summary = summariseHistory(series([13000, 13100]))!;

		expect(summary.low).toBe(13000);
		expect(summary.high).toBe(13100);
	});

	it('reports a fall as a negative change', () => {
		const summary = summariseHistory(series([13700, 12828]))!;

		expect(summary.change).toBe(-872);
		expect(summary.changeRatio).toBeCloseTo(-872 / 13700);
	});

	it('keeps everything in integer minor units', () => {
		const summary = summariseHistory(thirtyDays)!;

		for (const value of [summary.current, summary.low, summary.high, summary.change]) {
			expect(Number.isInteger(value)).toBe(true);
		}
	});

	it('avoids dividing by a zero baseline', () => {
		expect(summariseHistory(series([0, 500]))?.changeRatio).toBeNull();
	});

	it('returns nothing for an empty series', () => {
		expect(summariseHistory([])).toBeNull();
	});
});
