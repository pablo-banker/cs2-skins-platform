/**
 * How the price has moved since someone saved a skin.
 *
 * **From a buyer's point of view.** A wishlist is things somebody might buy,
 * so a lower price is good news and a higher one is a reason to wait. It is
 * not a portfolio: nothing here is a profit, a loss, a return or a gain, and
 * the copy that renders this must not say otherwise.
 *
 * Pure integer arithmetic on minor units. No floats, no percentages — a
 * percentage invites "my wishlist is up 8%", which is the portfolio framing
 * this deliberately avoids.
 */

/** A price, as the wishlist deals in them. */
export type Money = { amountMinor: number; currency: string };

export type PriceChange =
	| { kind: 'lower'; byMinor: number; currency: string }
	| { kind: 'higher'; byMinor: number; currency: string }
	| { kind: 'unchanged'; currency: string };

/**
 * The movement between a saved baseline and the current lowest ask, or
 * nothing.
 *
 * Nothing when there is no baseline (saved while the market was quiet), when
 * there is no current price, or when the two are in different currencies —
 * there is no FX anywhere in this product, and comparing across currencies
 * would produce a confident wrong number. Showing the current price alone is
 * the honest answer in all three cases.
 */
export function priceChangeSinceAdded(
	baseline: Money | undefined,
	current: Money | undefined
): PriceChange | undefined {
	if (!baseline || !current) return undefined;
	if (baseline.currency !== current.currency) return undefined;

	const delta = current.amountMinor - baseline.amountMinor;

	if (delta === 0) return { kind: 'unchanged', currency: current.currency };

	return delta < 0
		? { kind: 'lower', byMinor: -delta, currency: current.currency }
		: { kind: 'higher', byMinor: delta, currency: current.currency };
}
