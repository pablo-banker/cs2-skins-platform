/**
 * Comparing a basket of skins against Steam.
 *
 * Shared by editorial kits and the loadout builder, because "what would this
 * cost on Steam?" has to mean exactly the same thing in both places — and
 * because the all-or-nothing rule below is easy to get subtly wrong twice.
 */
import { isUsableQuote } from '$lib/features/kits/pricing';
import type { SkinMarketPrices } from '$lib/types/market';

/**
 * Steam's provider key, as CS2Cap publishes it.
 *
 * Named once. Matching on a display name instead would break the moment the
 * directory says "Steam Community Market", and a comparison that silently
 * stops working is worse than one that was never built.
 */
export const STEAM_PROVIDER_ID = 'steam';

export type SteamComparison = {
	totalMinor: number;
	currency: string;
	/**
	 * Steam's total minus what is being compared against. Positive means
	 * buying elsewhere is cheaper. Signed rather than clamped, so a caller can
	 * decline to make a claim it cannot support.
	 */
	savingsMinor: number;
};

/**
 * Steam's total for these exact items — or nothing.
 *
 * All-or-nothing on purpose. A "Steam total" missing one skin is not a Steam
 * total; it is a smaller number that looks like one, and every saving printed
 * beside it would be wrong.
 */
export function steamTotal(
	quoteSets: readonly (SkinMarketPrices | null)[]
): { totalMinor: number; currency: string } | undefined {
	if (quoteSets.length === 0) return undefined;

	let totalMinor = 0;
	let currency: string | undefined;

	for (const prices of quoteSets) {
		const steam = prices?.quotes.find(
			(quote) => quote.providerId === STEAM_PROVIDER_ID && isUsableQuote(quote)
		);

		if (!steam) return undefined;
		// One currency or no total. There is no FX anywhere in this product.
		if (currency && steam.currency !== currency) return undefined;

		currency = steam.currency;
		totalMinor += steam.priceMinor;
	}

	return currency ? { totalMinor, currency } : undefined;
}

/** Steam's total plus the difference against an already-computed total. */
export function steamComparison(
	quoteSets: readonly (SkinMarketPrices | null)[],
	against: { totalMinor: number; currency: string }
): SteamComparison | undefined {
	const steam = steamTotal(quoteSets);
	if (!steam || steam.currency !== against.currency) return undefined;

	return { ...steam, savingsMinor: steam.totalMinor - against.totalMinor };
}
