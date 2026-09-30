/**
 * Money formatting.
 *
 * Domain data carries money as **integer minor units** plus a currency code
 * (`12828` + `BRL`). This module is the one place that turns those into
 * something a person reads, so the division happens once, here, and never in a
 * component.
 */

/**
 * The application's display locale.
 *
 * Product copy is English for now, but the audience and the currency are
 * Brazilian — so money is formatted the way a Brazilian reads it
 * (`R$ 128,28`), independent of the interface language. Those are two
 * different decisions and they are allowed to disagree.
 */
export const DISPLAY_LOCALE = 'pt-BR';

/** The MVP display currency. Everything upstream is requested in BRL. */
export const DISPLAY_CURRENCY = 'BRL';

/**
 * `Intl.NumberFormat` is expensive to construct and these are reused on every
 * row of a comparison table, so instances are kept per locale+currency.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
	const key = `${locale}:${currency}`;
	let formatter = formatterCache.get(key);

	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
		formatterCache.set(key, formatter);
	}

	return formatter;
}

/**
 * How many minor units make one major unit of `currency`.
 *
 * Read from `Intl` rather than assumed to be 100: JPY has no minor unit at
 * all, and dividing its amounts by 100 would silently show every price as a
 * hundredth of itself. BRL is 100 today; this keeps the formatter honest the
 * day it is not.
 */
export function minorUnitScale(currency: string, locale: string = DISPLAY_LOCALE): number {
	try {
		const { maximumFractionDigits } = getFormatter(locale, currency).resolvedOptions();

		// The property is optional in the type but always present for a
		// currency-style formatter; 2 is the right guess if that ever changes.
		return 10 ** (maximumFractionDigits ?? 2);
	} catch {
		return 100;
	}
}

/**
 * Whether an amount is a real offer worth showing.
 *
 * Zero is not a price — it is upstream noise, and presenting it as "free" or
 * as a best price would be the most damaging bug this product could ship. Same
 * for negatives and non-integers, which cannot come from a correct minor-unit
 * value. Callers show an unavailable state instead.
 */
export function isDisplayableAmount(amountMinor: number | null | undefined): amountMinor is number {
	return typeof amountMinor === 'number' && Number.isInteger(amountMinor) && amountMinor > 0;
}

/**
 * Formats integer minor units for display: `12828` + `BRL` → `R$ 128,28`.
 *
 * It formats whatever it is given, including zero and negatives — deciding
 * *whether* an amount should be shown is {@link isDisplayableAmount}'s job, not
 * the formatter's.
 */
export function formatMoney(
	amountMinor: number,
	currency: string = DISPLAY_CURRENCY,
	locale: string = DISPLAY_LOCALE
): string {
	const major = amountMinor / minorUnitScale(currency, locale);

	try {
		return getFormatter(locale, currency).format(major);
	} catch {
		// An unrecognised currency code should degrade, not throw a page away.
		return `${currency} ${major.toFixed(2)}`;
	}
}
