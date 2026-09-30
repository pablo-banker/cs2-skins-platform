import { describe, expect, it } from 'vitest';
import {
	DISPLAY_CURRENCY,
	DISPLAY_LOCALE,
	formatMoney,
	isDisplayableAmount,
	minorUnitScale
} from './currency';

/** Locale output uses non-breaking spaces; compare on the visible characters. */
const normalize = (value: string) => value.replace(/\s+/gu, ' ').trim();

describe('formatMoney', () => {
	it('renders BRL minor units the way a Brazilian reads them', () => {
		expect(normalize(formatMoney(12828))).toBe('R$ 128,28');
		expect(normalize(formatMoney(489900))).toBe('R$ 4.899,00');
		expect(normalize(formatMoney(1))).toBe('R$ 0,01');
	});

	it('defaults to the application currency and locale', () => {
		expect(formatMoney(12828)).toBe(formatMoney(12828, DISPLAY_CURRENCY, DISPLAY_LOCALE));
	});

	it('formats zero and negatives rather than refusing them', () => {
		// Deciding whether to show an amount is isDisplayableAmount's job.
		expect(normalize(formatMoney(0))).toBe('R$ 0,00');
		expect(normalize(formatMoney(-500))).toContain('5,00');
	});

	it('respects a currency with no minor unit', () => {
		// 12828 JPY is ¥12,828 — not ¥128.28.
		expect(normalize(formatMoney(12828, 'JPY', 'en-US'))).toBe('¥12,828');
	});

	it('handles a currency with three decimal places', () => {
		expect(normalize(formatMoney(1234, 'KWD', 'en-US'))).toContain('1.234');
	});

	it('degrades instead of throwing on an unusable currency code', () => {
		expect(() => formatMoney(12828, 'NOT-A-CURRENCY')).not.toThrow();
		expect(formatMoney(12828, 'NOT-A-CURRENCY')).toContain('NOT-A-CURRENCY');
	});
});

describe('minorUnitScale', () => {
	it('reads the scale from the currency rather than assuming 100', () => {
		expect(minorUnitScale('BRL')).toBe(100);
		expect(minorUnitScale('USD')).toBe(100);
		expect(minorUnitScale('JPY')).toBe(1);
		expect(minorUnitScale('KWD')).toBe(1000);
	});

	it('falls back to 100 for an unusable code', () => {
		expect(minorUnitScale('NOT-A-CURRENCY')).toBe(100);
	});
});

describe('isDisplayableAmount', () => {
	it('accepts a real positive integer amount', () => {
		expect(isDisplayableAmount(12828)).toBe(true);
		expect(isDisplayableAmount(1)).toBe(true);
	});

	it('rejects zero, which is upstream noise and never a real offer', () => {
		expect(isDisplayableAmount(0)).toBe(false);
	});

	it('rejects negatives, fractions and missing values', () => {
		expect(isDisplayableAmount(-500)).toBe(false);
		expect(isDisplayableAmount(128.28)).toBe(false);
		expect(isDisplayableAmount(null)).toBe(false);
		expect(isDisplayableAmount(undefined)).toBe(false);
		expect(isDisplayableAmount(Number.NaN)).toBe(false);
	});
});
