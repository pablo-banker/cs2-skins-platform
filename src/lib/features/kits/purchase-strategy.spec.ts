import { describe, expect, it } from 'vitest';
import {
	buildFewerMarketplacesPlan,
	buildLowestPricePlan,
	buildPurchasePlans,
	buildSteamComparison,
	MAX_STRATEGY_ITEMS,
	STEAM_PROVIDER_ID
} from './purchase-strategy';
import { emptyItem, failedItem, priced, providersOf, quote } from './fixtures';
import type { PricedKitItem } from './pricing';

describe('buildLowestPricePlan', () => {
	it('buys a single item at its cheapest marketplace', () => {
		const plan = buildLowestPricePlan([
			priced(1, [
				['csfloat', 900],
				['steam', 700]
			])
		]);

		expect(plan?.totalMinor).toBe(700);
		expect(plan?.providerCount).toBe(1);
		expect(providersOf(plan!.lines)).toEqual(['steam']);
	});

	it('buys each item wherever it is cheapest, however many marketplaces that takes', () => {
		const plan = buildLowestPricePlan([
			priced(1, [
				['steam', 700],
				['csfloat', 900]
			]),
			priced(2, [
				['steam', 2000],
				['csfloat', 1500]
			]),
			priced(3, [
				['skinport', 300],
				['steam', 450]
			])
		]);

		expect(providersOf(plan!.lines)).toEqual(['steam', 'csfloat', 'skinport']);
		expect(plan?.totalMinor).toBe(700 + 1500 + 300);
		expect(plan?.providerCount).toBe(3);
	});

	it('counts one marketplace when it happens to be cheapest for everything', () => {
		const plan = buildLowestPricePlan([
			priced(1, [
				['steam', 100],
				['csfloat', 500]
			]),
			priced(2, [
				['steam', 200],
				['csfloat', 600]
			])
		]);

		expect(plan?.providerCount).toBe(1);
		expect(plan?.groups).toHaveLength(1);
	});

	it('ignores a zero quote even when it is the lowest number present', () => {
		const plan = buildLowestPricePlan([
			priced(1, [
				['broken', 0],
				['steam', 700]
			])
		]);

		expect(plan?.totalMinor).toBe(700);
		expect(providersOf(plan!.lines)).toEqual(['steam']);
	});

	it('ignores a stale quote even when it is cheapest', () => {
		const item = priced(1, [['steam', 700]]);
		item.prices?.quotes.unshift(quote('ghost', 100, item.item.variant.itemId, { stale: true }));

		const plan = buildLowestPricePlan([item]);

		expect(plan?.totalMinor).toBe(700);
	});

	it('breaks a price tie on provider id', () => {
		const plan = buildLowestPricePlan([
			priced(1, [
				['zebra', 500],
				['alpha', 500]
			])
		]);

		expect(providersOf(plan!.lines)).toEqual(['alpha']);
	});

	it('produces no plan when one item has no quotes', () => {
		expect(buildLowestPricePlan([priced(1, [['steam', 700]]), emptyItem(2)])).toBeUndefined();
	});

	it('produces no plan when one item failed to load', () => {
		expect(buildLowestPricePlan([priced(1, [['steam', 700]]), failedItem(2)])).toBeUndefined();
	});

	it('produces no plan for an empty kit', () => {
		expect(buildLowestPricePlan([])).toBeUndefined();
	});

	it('keeps the exact quote for each line, redirect and all', () => {
		const plan = buildLowestPricePlan([priced(1, [['steam', 700]])]);

		expect(plan?.lines[0].quote.redirectUrl).toBe('https://cs2c.app/r/steam/1001');
		expect(plan?.lines[0].quote.itemId).toBe(1001);
	});

	it('does not mutate its input', () => {
		const items = [
			priced(1, [
				['steam', 700],
				['csfloat', 900]
			]),
			priced(2, [['skinport', 400]])
		];
		const snapshot = structuredClone(items);

		buildLowestPricePlan(items);

		expect(items).toEqual(snapshot);
	});

	it('refuses to add quotes in different currencies', () => {
		// No FX anywhere in this product, and a mixed total is wrong rather
		// than merely missing.
		const items = [priced(1, [['steam', 700]]), priced(2, [['steam', 900]], { currency: 'USD' })];

		expect(buildLowestPricePlan(items)).toBeUndefined();
	});
});

describe('purchase plan grouping', () => {
	it('groups lines by marketplace with its own subtotal', () => {
		const plan = buildLowestPricePlan([
			priced(1, [['steam', 700]]),
			priced(2, [['csfloat', 1500]]),
			priced(3, [['steam', 450]])
		]);

		expect(plan?.groups.map((group) => group.providerId)).toEqual(['steam', 'csfloat']);
		expect(plan?.groups[0].subtotalMinor).toBe(1150);
		expect(plan?.groups[1].subtotalMinor).toBe(1500);
	});

	it('assigns every item exactly once across the groups', () => {
		const plan = buildLowestPricePlan([
			priced(1, [['steam', 700]]),
			priced(2, [['csfloat', 1500]]),
			priced(3, [['steam', 450]])
		]);

		const assigned = plan!.groups.flatMap((group) =>
			group.lines.map((line) => line.priced.item.variant.itemId)
		);

		expect(assigned).toHaveLength(3);
		expect(new Set(assigned).size).toBe(3);
	});

	it('subtotals add up to the total', () => {
		const plan = buildLowestPricePlan([
			priced(1, [['steam', 700]]),
			priced(2, [['csfloat', 1500]]),
			priced(3, [['skinport', 450]])
		]);

		const sum = plan!.groups.reduce((total, group) => total + group.subtotalMinor, 0);

		expect(sum).toBe(plan?.totalMinor);
	});

	it('never lists a marketplace nothing was assigned to', () => {
		// Both quote, only one is bought from.
		const plan = buildLowestPricePlan([
			priced(1, [
				['steam', 700],
				['csfloat', 900]
			])
		]);

		expect(plan?.groups.map((group) => group.providerId)).toEqual(['steam']);
		expect(plan?.providerCount).toBe(1);
	});
});

describe('buildFewerMarketplacesPlan', () => {
	it('uses one marketplace when one covers everything', () => {
		const plan = buildFewerMarketplacesPlan([
			priced(1, [
				['steam', 1000],
				['csfloat', 700]
			]),
			priced(2, [['steam', 2000]])
		]);

		expect(plan?.providerCount).toBe(1);
		expect(providersOf(plan!.lines)).toEqual(['steam', 'steam']);
		expect(plan?.totalMinor).toBe(3000);
	});

	it('uses two when no single marketplace covers everything', () => {
		const plan = buildFewerMarketplacesPlan([
			priced(1, [['alpha', 100]]),
			priced(2, [['alpha', 200]]),
			priced(3, [['beta', 300]])
		]);

		expect(plan?.providerCount).toBe(2);
		expect(providersOf(plan!.lines)).toEqual(['alpha', 'alpha', 'beta']);
	});

	it('trades a cheaper total for fewer marketplaces', () => {
		const items = [
			priced(1, [
				['cheap1', 100],
				['one-stop', 130]
			]),
			priced(2, [
				['cheap2', 200],
				['one-stop', 230]
			]),
			priced(3, [
				['cheap3', 300],
				['one-stop', 330]
			]),
			priced(4, [
				['cheap4', 400],
				['one-stop', 430]
			])
		];

		const lowest = buildLowestPricePlan(items);
		const fewer = buildFewerMarketplacesPlan(items);

		expect(lowest?.providerCount).toBe(4);
		expect(lowest?.totalMinor).toBe(1000);
		expect(fewer?.providerCount).toBe(1);
		expect(fewer?.totalMinor).toBe(1120);
	});

	it('is exact where a greedy largest-coverage choice is wrong', () => {
		// Greedy would take `wide` first because it covers four of six, then
		// need both `left` and `right` for what is left — three marketplaces.
		// `left` and `right` together cover all six, so the answer is two.
		const items = [
			priced(1, [
				['wide', 100],
				['left', 110]
			]),
			priced(2, [
				['wide', 100],
				['left', 110]
			]),
			priced(3, [
				['wide', 100],
				['right', 110]
			]),
			priced(4, [
				['wide', 100],
				['right', 110]
			]),
			priced(5, [['left', 500]]),
			priced(6, [['right', 500]])
		];

		const plan = buildFewerMarketplacesPlan(items);

		expect(plan?.providerCount).toBe(2);
		expect(new Set(providersOf(plan!.lines))).toEqual(new Set(['left', 'right']));
		expect(plan?.totalMinor).toBe(110 * 4 + 500 * 2);
	});

	it('picks the cheaper of two plans that use the same number of marketplaces', () => {
		const plan = buildFewerMarketplacesPlan([
			priced(1, [
				['pricey', 1000],
				['thrifty', 900]
			]),
			priced(2, [
				['pricey', 2000],
				['thrifty', 1800]
			])
		]);

		expect(plan?.providerCount).toBe(1);
		expect(providersOf(plan!.lines)).toEqual(['thrifty', 'thrifty']);
		expect(plan?.totalMinor).toBe(2700);
	});

	it('minimises marketplaces before price, not the other way round', () => {
		const plan = buildFewerMarketplacesPlan([
			priced(1, [
				['solo', 1000],
				['bargain', 1]
			]),
			priced(2, [['solo', 1000]])
		]);

		// `bargain` is almost free but cannot supply item 2.
		expect(plan?.providerCount).toBe(1);
		expect(plan?.totalMinor).toBe(2000);
	});

	it('breaks a tie between equal-cost, equal-count plans deterministically', () => {
		const items = [
			priced(1, [
				['zulu', 500],
				['alpha', 500]
			]),
			priced(2, [
				['zulu', 700],
				['alpha', 700]
			])
		];

		const first = buildFewerMarketplacesPlan(items);
		const second = buildFewerMarketplacesPlan([...items].reverse());

		expect(providersOf(first!.lines)).toEqual(['alpha', 'alpha']);
		expect(new Set(providersOf(second!.lines))).toEqual(new Set(['alpha']));
	});

	it('ignores a marketplace that only partially covers the kit when it cannot help', () => {
		const plan = buildFewerMarketplacesPlan([
			priced(1, [
				['everything', 500],
				['partial', 10]
			]),
			priced(2, [['everything', 500]]),
			priced(3, [['everything', 500]])
		]);

		expect(plan?.providerCount).toBe(1);
		expect(plan?.groups.map((group) => group.providerId)).toEqual(['everything']);
	});

	it('ignores stale and zero quotes when deciding coverage', () => {
		const item = priced(1, [['alpha', 100]]);
		item.prices?.quotes.push(quote('phantom', 5, item.item.variant.itemId, { stale: true }));

		const plan = buildFewerMarketplacesPlan([item, priced(2, [['beta', 200]])]);

		// `phantom` must not count as covering item 1.
		expect(plan?.providerCount).toBe(2);
		expect(new Set(providersOf(plan!.lines))).toEqual(new Set(['alpha', 'beta']));
	});

	it('produces no plan when one item has no quotes', () => {
		expect(buildFewerMarketplacesPlan([priced(1, [['steam', 700]]), emptyItem(2)])).toBeUndefined();
	});

	it('produces no plan when one item failed to load', () => {
		expect(
			buildFewerMarketplacesPlan([priced(1, [['steam', 700]]), failedItem(2)])
		).toBeUndefined();
	});

	it('refuses to add quotes in different currencies', () => {
		const items = [priced(1, [['steam', 700]]), priced(2, [['steam', 900]], { currency: 'USD' })];

		expect(buildFewerMarketplacesPlan(items)).toBeUndefined();
	});

	it('does not mutate its input', () => {
		const items = [
			priced(1, [
				['alpha', 100],
				['beta', 120]
			]),
			priced(2, [['beta', 200]])
		];
		const snapshot = structuredClone(items);

		buildFewerMarketplacesPlan(items);

		expect(items).toEqual(snapshot);
	});

	it('solves the largest kit the editorial limit allows', () => {
		// Eight items, three marketplaces, none covering everything. `north`
		// and `south` together cover all eight; `middle` is a cheap decoy that
		// covers six and would tempt a greedy choice into needing three.
		const items: PricedKitItem[] = [];

		for (let index = 0; index < MAX_STRATEGY_ITEMS; index++) {
			const offers: [string, number][] = index < 4 ? [['north', 100]] : [['south', 100]];
			if (index >= 1 && index <= 6) offers.push(['middle', 10]);

			items.push(priced(index + 1, offers));
		}

		const plan = buildFewerMarketplacesPlan(items);

		expect(plan?.providerCount).toBe(2);
		expect(new Set(providersOf(plan!.lines))).toEqual(new Set(['north', 'south']));
		expect(plan?.lines).toHaveLength(MAX_STRATEGY_ITEMS);
	});

	it('declines a kit larger than the exact search is designed for', () => {
		const items = Array.from({ length: MAX_STRATEGY_ITEMS + 1 }, (_, index) =>
			priced(index + 1, [['steam', 100]])
		);

		expect(buildFewerMarketplacesPlan(items)).toBeUndefined();
	});

	it('reports a marketplace count that matches its own assignment', () => {
		const items = [
			priced(1, [
				['alpha', 100],
				['beta', 90]
			]),
			priced(2, [
				['alpha', 200],
				['beta', 300]
			]),
			priced(3, [['gamma', 50]])
		];

		const plan = buildFewerMarketplacesPlan(items)!;

		expect(plan.providerCount).toBe(new Set(providersOf(plan.lines)).size);
		expect(plan.providerCount).toBe(plan.groups.length);
	});
});

describe('buildPurchasePlans', () => {
	it('returns both strategies over the same data', () => {
		const plans = buildPurchasePlans([
			priced(1, [
				['alpha', 100],
				['beta', 130]
			]),
			priced(2, [['beta', 200]])
		]);

		expect(plans?.lowestPrice.strategy).toBe('lowest-price');
		expect(plans?.fewerMarketplaces.strategy).toBe('fewer-marketplaces');
		expect(plans?.lowestPrice.providerCount).toBe(2);
		expect(plans?.fewerMarketplaces.providerCount).toBe(1);
		expect(plans?.equivalent).toBe(false);
	});

	it('marks the strategies equivalent when they land on the same plan', () => {
		const plans = buildPurchasePlans([priced(1, [['steam', 100]]), priced(2, [['steam', 200]])]);

		expect(plans?.equivalent).toBe(true);
		expect(plans?.lowestPrice.totalMinor).toBe(plans?.fewerMarketplaces.totalMinor);
	});

	it('returns nothing when the kit is not fully priced', () => {
		expect(buildPurchasePlans([priced(1, [['steam', 100]]), failedItem(2)])).toBeUndefined();
	});

	it('never lets the fewer-marketplaces plan beat the lowest-price total', () => {
		const items = [
			priced(1, [
				['alpha', 100],
				['beta', 130]
			]),
			priced(2, [
				['alpha', 400],
				['beta', 200]
			])
		];

		const plans = buildPurchasePlans(items)!;

		expect(plans.fewerMarketplaces.totalMinor).toBeGreaterThanOrEqual(plans.lowestPrice.totalMinor);
		expect(plans.fewerMarketplaces.providerCount).toBeLessThanOrEqual(
			plans.lowestPrice.providerCount
		);
	});
});

describe('buildSteamComparison', () => {
	function withSteam(): PricedKitItem[] {
		return [
			priced(1, [
				[STEAM_PROVIDER_ID, 1000],
				['csfloat', 800]
			]),
			priced(2, [
				[STEAM_PROVIDER_ID, 2000],
				['csfloat', 1700]
			])
		];
	}

	it('sums Steam for the same variants and reports the exact difference', () => {
		const items = withSteam();
		const lowest = buildLowestPricePlan(items)!;

		const steam = buildSteamComparison(items, lowest);

		expect(steam?.totalMinor).toBe(3000);
		expect(lowest.totalMinor).toBe(2500);
		expect(steam?.savingsMinor).toBe(500);
		expect(steam?.currency).toBe('BRL');
	});

	it('counts Steam when Steam is itself the cheapest on an item', () => {
		const items = [
			priced(1, [
				[STEAM_PROVIDER_ID, 500],
				['csfloat', 900]
			]),
			priced(2, [
				[STEAM_PROVIDER_ID, 1000],
				['csfloat', 700]
			])
		];
		const lowest = buildLowestPricePlan(items)!;

		const steam = buildSteamComparison(items, lowest);

		expect(steam?.totalMinor).toBe(1500);
		expect(lowest.totalMinor).toBe(1200);
		expect(steam?.savingsMinor).toBe(300);
	});

	it('reports no saving when Steam is cheapest everywhere', () => {
		const items = [
			priced(1, [
				[STEAM_PROVIDER_ID, 500],
				['csfloat', 900]
			])
		];
		const lowest = buildLowestPricePlan(items)!;

		expect(buildSteamComparison(items, lowest)?.savingsMinor).toBe(0);
	});

	it('gives no comparison when Steam is missing one item', () => {
		const items = [priced(1, [[STEAM_PROVIDER_ID, 1000]]), priced(2, [['csfloat', 1700]])];
		const lowest = buildLowestPricePlan(items)!;

		// A "Steam total" missing a skin is not a Steam total.
		expect(buildSteamComparison(items, lowest)).toBeUndefined();
	});

	it('gives no comparison when the only Steam quote is stale', () => {
		const items = withSteam();
		const steamQuote = items[0].prices?.quotes.find(
			(entry) => entry.providerId === STEAM_PROVIDER_ID
		);
		if (steamQuote) steamQuote.stale = true;

		const lowest = buildLowestPricePlan(items)!;

		expect(buildSteamComparison(items, lowest)).toBeUndefined();
	});

	it('gives no comparison across currencies', () => {
		const items = [
			priced(1, [[STEAM_PROVIDER_ID, 1000]]),
			priced(2, [[STEAM_PROVIDER_ID, 2000]], { currency: 'USD' })
		];
		const lowest = buildLowestPricePlan([priced(1, [[STEAM_PROVIDER_ID, 1000]])])!;

		expect(buildSteamComparison(items, lowest)).toBeUndefined();
	});

	it('identifies Steam by provider key, never by display name', () => {
		const items = [priced(1, [['steamcommunity', 1000]])];
		const lowest = buildLowestPricePlan(items)!;

		expect(buildSteamComparison(items, lowest)).toBeUndefined();
	});
});

describe('transport equivalence', () => {
	it('produces identical plans whether or not quotes carry a redirect', () => {
		// Batch responses carry no `link`; that must change the offer button
		// and nothing else.
		const withLinks = [
			priced(1, [
				['alpha', 100],
				['beta', 130]
			]),
			priced(2, [['beta', 200]])
		];
		const withoutLinks = [
			priced(
				1,
				[
					['alpha', 100],
					['beta', 130]
				],
				{ redirectUrl: undefined }
			),
			priced(2, [['beta', 200]], { redirectUrl: undefined })
		];

		const a = buildPurchasePlans(withLinks)!;
		const b = buildPurchasePlans(withoutLinks)!;

		expect(b.lowestPrice.totalMinor).toBe(a.lowestPrice.totalMinor);
		expect(providersOf(b.lowestPrice.lines)).toEqual(providersOf(a.lowestPrice.lines));
		expect(b.fewerMarketplaces.totalMinor).toBe(a.fewerMarketplaces.totalMinor);
		expect(providersOf(b.fewerMarketplaces.lines)).toEqual(providersOf(a.fewerMarketplaces.lines));
		expect(b.equivalent).toBe(a.equivalent);
	});
});

/**
 * The dynamic program, checked against the answer by definition.
 *
 * The exhaustive version enumerates every provider-per-item assignment, which
 * is exactly what the DP exists to avoid. On five items and four marketplaces
 * that is 1,024 assignments — cheap here, and it settles whether the DP is
 * genuinely exact or merely plausible.
 */
function exhaustiveOptimum(
	items: PricedKitItem[]
): { providers: number; total: number } | undefined {
	const options = items.map((item) =>
		(item.prices?.quotes ?? []).filter((entry) => !entry.stale && entry.priceMinor > 0)
	);

	if (options.some((quotes) => quotes.length === 0)) return undefined;

	let best: { providers: number; total: number } | undefined;

	function walk(index: number, chosen: string[], total: number): void {
		if (index === items.length) {
			const providers = new Set(chosen).size;

			if (
				!best ||
				providers < best.providers ||
				(providers === best.providers && total < best.total)
			) {
				best = { providers, total };
			}

			return;
		}

		for (const option of options[index]) {
			walk(index + 1, [...chosen, option.providerId], total + option.priceMinor);
		}
	}

	walk(0, [], 0);

	return best;
}

/** Deterministic pseudo-random source, so a failure is always reproducible. */
function makeRandom(seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

describe('fewer-marketplaces exactness', () => {
	it('matches exhaustive search on randomised kits', () => {
		const providerIds = ['alpha', 'beta', 'gamma', 'delta'];

		for (let seed = 1; seed <= 60; seed++) {
			const random = makeRandom(seed);
			const itemCount = 2 + Math.floor(random() * 4);
			const items: PricedKitItem[] = [];

			for (let index = 0; index < itemCount; index++) {
				const offers: [string, number][] = [];

				for (const providerId of providerIds) {
					if (random() < 0.55) offers.push([providerId, 100 + Math.floor(random() * 900)]);
				}

				// Every item needs at least one offer for a plan to exist.
				if (offers.length === 0) offers.push([providerIds[0], 100 + Math.floor(random() * 900)]);

				items.push(priced(index + 1, offers));
			}

			const plan = buildFewerMarketplacesPlan(items);
			const optimum = exhaustiveOptimum(items);

			expect(plan, `seed ${seed}`).toBeDefined();
			expect(plan?.providerCount, `seed ${seed} marketplaces`).toBe(optimum?.providers);
			expect(plan?.totalMinor, `seed ${seed} total`).toBe(optimum?.total);
		}
	});

	it('matches exhaustive search when coverage is sparse', () => {
		// Sparse coverage is where a greedy choice is most likely to be wrong.
		const providerIds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

		for (let seed = 101; seed <= 160; seed++) {
			const random = makeRandom(seed);
			const items: PricedKitItem[] = [];

			for (let index = 0; index < 5; index++) {
				const offers: [string, number][] = [];

				for (const providerId of providerIds) {
					if (random() < 0.3) offers.push([providerId, 100 + Math.floor(random() * 900)]);
				}

				if (offers.length === 0) {
					offers.push([
						providerIds[Math.floor(random() * providerIds.length)],
						100 + Math.floor(random() * 900)
					]);
				}

				items.push(priced(index + 1, offers));
			}

			const plan = buildFewerMarketplacesPlan(items);
			const optimum = exhaustiveOptimum(items);

			expect(plan?.providerCount, `seed ${seed} marketplaces`).toBe(optimum?.providers);
			expect(plan?.totalMinor, `seed ${seed} total`).toBe(optimum?.total);
		}
	});
});
