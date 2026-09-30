/**
 * Working out how to actually buy a kit.
 *
 * Two deterministic strategies over the quotes already loaded, and a Steam
 * comparison. Everything here is pure: integer minor units in, integer minor
 * units out, no Svelte, no I/O, no CS2Cap types. Switching strategy in the UI
 * therefore costs nothing — it is the same data read a different way.
 *
 * Neither strategy recommends. They are two factual answers to two different
 * questions ("what is cheapest?" and "what needs the fewest accounts?"), and
 * the visitor decides which they care about.
 */
import type { MarketQuote } from '$lib/types/market';
import { cheapestQuote, isFullyPriced, usableQuotes, type PricedKitItem } from './pricing';
import { steamComparison, type SteamComparison } from '$lib/features/prices/steam';

export const PURCHASE_STRATEGIES = ['lowest-price', 'fewer-marketplaces'] as const;

export type PurchaseStrategy = (typeof PURCHASE_STRATEGIES)[number];

export type PurchasePlanLine = {
	priced: PricedKitItem;
	/** The exact quote this plan buys at — provider, amount and offer link. */
	quote: MarketQuote;
};

export type PurchaseProviderGroup = {
	providerId: string;
	lines: PurchasePlanLine[];
	/** Sum of this group's lines only. Never a share of the kit total. */
	subtotalMinor: number;
};

export type PurchasePlan = {
	strategy: PurchaseStrategy;
	/** Every kit item, in editorial order, each assigned exactly once. */
	lines: PurchasePlanLine[];
	/** The same lines, gathered by marketplace in order of first appearance. */
	groups: PurchaseProviderGroup[];
	totalMinor: number;
	currency: string;
	/** Distinct marketplaces this plan requires. */
	providerCount: number;
};

/**
 * The upper bound the exact algorithm below is designed for.
 *
 * Editorial kits hold at most eight items (`KIT_MAX_ITEMS`), which is what
 * makes an exact search affordable — see `buildFewerMarketplacesPlan`. A
 * builder with dozens of slots would need a different implementation, not a
 * bigger constant.
 */
export const MAX_STRATEGY_ITEMS = 8;

/**
 * Groups a finished assignment by marketplace.
 *
 * Group order follows the first item each marketplace appears against, so the
 * plan reads in the same order as the kit rather than jumping around.
 */
function groupByProvider(lines: PurchasePlanLine[]): PurchaseProviderGroup[] {
	const groups = new Map<string, PurchaseProviderGroup>();

	for (const line of lines) {
		const group = groups.get(line.quote.providerId) ?? {
			providerId: line.quote.providerId,
			lines: [],
			subtotalMinor: 0
		};

		group.lines.push(line);
		group.subtotalMinor += line.quote.priceMinor;
		groups.set(line.quote.providerId, group);
	}

	return [...groups.values()];
}

/**
 * The one currency every quote in a plan shares.
 *
 * Returns nothing when they disagree. We only ever request BRL, so a mismatch
 * means something upstream changed underneath us — and adding two currencies
 * together would produce a number that is wrong rather than merely missing.
 * There is no FX anywhere in this product and this is not the place to start.
 */
function commonCurrency(quotes: readonly MarketQuote[]): string | undefined {
	const first = quotes[0]?.currency;
	if (!first) return undefined;

	return quotes.every((quote) => quote.currency === first) ? first : undefined;
}

function toPlan(strategy: PurchaseStrategy, lines: PurchasePlanLine[]): PurchasePlan | undefined {
	const currency = commonCurrency(lines.map((line) => line.quote));
	if (!currency) return undefined;

	return {
		strategy,
		lines,
		groups: groupByProvider(lines),
		totalMinor: lines.reduce((sum, line) => sum + line.quote.priceMinor, 0),
		currency,
		providerCount: new Set(lines.map((line) => line.quote.providerId)).size
	};
}

/**
 * Buy every item wherever it is cheapest right now.
 *
 * The cheapest possible total, at the cost of however many marketplaces that
 * takes. Ties go to the lexically first provider id so the same data always
 * produces the same plan.
 *
 * Returns nothing unless **every** item has a usable quote: a total that
 * silently omits an item is indistinguishable from a complete one.
 */
export function buildLowestPricePlan(items: readonly PricedKitItem[]): PurchasePlan | undefined {
	if (!isFullyPriced(items)) return undefined;

	const lines: PurchasePlanLine[] = [];

	for (const priced of items) {
		const quote = cheapestQuote(priced);
		if (!quote) return undefined;

		lines.push({ priced, quote });
	}

	return toPlan('lowest-price', lines);
}

/** Cheapest usable quote per provider, for one item. */
function quotesByProvider(priced: PricedKitItem): Map<string, MarketQuote> {
	const byProvider = new Map<string, MarketQuote>();

	for (const quote of usableQuotes(priced)) {
		const current = byProvider.get(quote.providerId);
		if (!current || quote.priceMinor < current.priceMinor) byProvider.set(quote.providerId, quote);
	}

	return byProvider;
}

type SearchState = {
	/** Marketplaces used so far. Minimised first. */
	providers: number;
	totalMinor: number;
	/** Chosen quote per item index; complete once every slot is filled. */
	assignment: (MarketQuote | undefined)[];
};

/** Assignment identity, so two equally good plans still order deterministically. */
function assignmentKey(state: SearchState): string {
	return state.assignment.map((quote) => quote?.providerId ?? '').join('|');
}

/**
 * Strictly better, by the stated priority: fewest marketplaces, then lowest
 * total, then a stable ordering that exists only so the result never depends
 * on iteration order.
 */
function isBetter(candidate: SearchState, incumbent: SearchState | undefined): boolean {
	if (!incumbent) return true;
	if (candidate.providers !== incumbent.providers) {
		return candidate.providers < incumbent.providers;
	}
	if (candidate.totalMinor !== incumbent.totalMinor) {
		return candidate.totalMinor < incumbent.totalMinor;
	}

	return assignmentKey(candidate) < assignmentKey(incumbent);
}

/**
 * Buy the kit from as few marketplaces as possible, then as cheaply as
 * possible within that.
 *
 * **Exact, not greedy.** Picking the marketplace that covers the most items
 * and repeating is the obvious approach and it is wrong: a marketplace
 * covering four of five items can force a second one for the fifth, where two
 * marketplaces covering three and two would have done. Getting that wrong
 * means telling someone they need three accounts when they need two.
 *
 * So this searches exhaustively over **item coverage**, not over provider
 * combinations. The state is the set of items already assigned — at most
 * `2^MAX_STRATEGY_ITEMS` = 256 of them — and each step gives one marketplace a
 * subset of the items it can supply. Fixing the lowest unassigned item at
 * every step keeps each plan reachable exactly one way. Cost and marketplace
 * count both only ever increase, so comparing states lexicographically as they
 * grow finds the true optimum.
 *
 * The bound is what makes this affordable, and it is the editorial kit size
 * limit rather than an arbitrary cutoff. Anything larger needs a different
 * algorithm, not a larger constant.
 */
export function buildFewerMarketplacesPlan(
	items: readonly PricedKitItem[]
): PurchasePlan | undefined {
	if (!isFullyPriced(items) || items.length > MAX_STRATEGY_ITEMS) return undefined;

	const offers = items.map(quotesByProvider);
	if (offers.some((byProvider) => byProvider.size === 0)) return undefined;

	// One entry per marketplace: which items it can supply, and at what price.
	const providers = new Map<string, { mask: number; quotes: (MarketQuote | undefined)[] }>();

	offers.forEach((byProvider, index) => {
		for (const [providerId, quote] of byProvider) {
			const entry = providers.get(providerId) ?? {
				mask: 0,
				quotes: new Array<MarketQuote | undefined>(items.length)
			};

			entry.mask |= 1 << index;
			entry.quotes[index] = quote;
			providers.set(providerId, entry);
		}
	});

	// Provider iteration order must not influence the result; the comparison
	// already breaks ties, and sorting makes that independent of Map order.
	const candidates = [...providers.entries()].sort(([a], [b]) => a.localeCompare(b));

	const complete = (1 << items.length) - 1;
	const best = new Array<SearchState | undefined>(complete + 1);
	best[0] = { providers: 0, totalMinor: 0, assignment: new Array(items.length) };

	for (let covered = 0; covered < complete; covered++) {
		const state = best[covered];
		if (!state) continue;

		// The lowest unassigned item has to be bought from somewhere, so make
		// this step the step that buys it.
		let next = 0;
		while ((covered & (1 << next)) !== 0) next++;
		const nextBit = 1 << next;

		for (const [, entry] of candidates) {
			if ((entry.mask & nextBit) === 0) continue;

			const available = entry.mask & ~covered & ~nextBit;

			// Every subset of the other items this marketplace could also
			// supply in the same step, including none of them.
			for (let extra = available; ; extra = (extra - 1) & available) {
				const taken = extra | nextBit;

				let totalMinor = state.totalMinor;
				const assignment = [...state.assignment];

				for (let index = 0; index < items.length; index++) {
					if ((taken & (1 << index)) === 0) continue;

					// `taken` is a subset of this marketplace's coverage, so a
					// quote is always here. Skipping rather than assuming means
					// a gap would leave the slot unassigned and drop the plan,
					// never inflate a total with a missing line.
					const quote = entry.quotes[index];
					if (!quote) continue;

					assignment[index] = quote;
					totalMinor += quote.priceMinor;
				}

				const candidate: SearchState = {
					providers: state.providers + 1,
					totalMinor,
					assignment
				};

				const target = covered | taken;
				if (isBetter(candidate, best[target])) best[target] = candidate;

				if (extra === 0) break;
			}
		}
	}

	const solution = best[complete];
	if (!solution) return undefined;

	const lines: PurchasePlanLine[] = [];

	for (const [index, priced] of items.entries()) {
		const quote = solution.assignment[index];
		if (!quote) return undefined;

		lines.push({ priced, quote });
	}

	return toPlan('fewer-marketplaces', lines);
}

/** Both strategies over the same data, when the kit is fully priced. */
export type KitPurchasePlans = {
	lowestPrice: PurchasePlan;
	fewerMarketplaces: PurchasePlan;
	/**
	 * True when the cheapest plan already uses the fewest marketplaces and
	 * costs the same — presenting it twice would be noise, not a choice.
	 */
	equivalent: boolean;
};

export function buildPurchasePlans(items: readonly PricedKitItem[]): KitPurchasePlans | undefined {
	const lowestPrice = buildLowestPricePlan(items);
	const fewerMarketplaces = buildFewerMarketplacesPlan(items);

	if (!lowestPrice || !fewerMarketplaces) return undefined;

	return {
		lowestPrice,
		fewerMarketplaces,
		equivalent:
			lowestPrice.totalMinor === fewerMarketplaces.totalMinor &&
			lowestPrice.providerCount === fewerMarketplaces.providerCount
	};
}

/**
 * Steam's provider key and comparison shape.
 *
 * Re-exported rather than redefined: the builder compares baskets against
 * Steam too, and the all-or-nothing rule has to mean the same thing in both
 * places. The implementation lives in `$lib/features/prices/steam`.
 */
export { STEAM_PROVIDER_ID, type SteamComparison } from '$lib/features/prices/steam';

/**
 * Steam's total for the exact same variants, when Steam quotes all of them.
 *
 * All-or-nothing for the same reason kit totals are: a "Steam total" missing
 * one skin is not a Steam total, it is a smaller number that looks like one —
 * and it would make every saving next to it wrong.
 */
export function buildSteamComparison(
	items: readonly PricedKitItem[],
	lowestPrice: PurchasePlan
): SteamComparison | undefined {
	return steamComparison(
		items.map((priced) => priced.prices),
		{ totalMinor: lowestPrice.totalMinor, currency: lowestPrice.currency }
	);
}
