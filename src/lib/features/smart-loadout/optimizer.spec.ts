import { describe, expect, it } from 'vitest';
import { minimumTotal, optimizeLoadout, type CandidatePool } from './optimizer';
import type { SmartCandidate } from '$lib/types/smart-loadout';

function candidate(
	entryId: string,
	skinSlug: string,
	priceMinor: number,
	visualScore: number,
	overrides: Partial<SmartCandidate> = {}
): SmartCandidate {
	return {
		entryId,
		slotId: entryId,
		skinSlug,
		variant: { wear: 'Field-Tested', edition: 'normal' },
		itemId: skinSlug.length * 100 + priceMinor,
		visualScore,
		match: 'color',
		priceMinor,
		currency: 'BRL',
		providerId: 'csfloat',
		weapon: 'AK-47',
		skinName: skinSlug,
		fullName: `AK-47 | ${skinSlug}`,
		slotLabel: entryId,
		...overrides
	};
}

function pool(entryId: string, ...candidates: SmartCandidate[]): CandidatePool {
	return { entryId, candidates };
}

/** The chosen skins, for readable assertions. */
function picked(result: ReturnType<typeof optimizeLoadout>): string[] {
	return result.ok ? result.picks.map((pick) => pick.skinSlug) : [];
}

describe('choosing within a budget', () => {
	it('takes the only candidate when there is one per entry', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'one', 1000, 3)), pool('b', candidate('b', 'two', 2000, 3))],
			100000
		);

		expect(result.ok).toBe(true);
		expect(picked(result)).toEqual(['one', 'two']);
		expect(result.ok && result.totalMinor).toBe(3000);
	});

	it('takes the best visual match when the budget allows', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'cheap', 1000, 1), candidate('a', 'best', 5000, 5))],
			100000
		);

		expect(picked(result)).toEqual(['best']);
	});

	it('takes a more expensive candidate when it matches better', () => {
		const result = optimizeLoadout(
			[
				pool('a', candidate('a', 'ok', 1000, 3), candidate('a', 'better', 9000, 5)),
				pool('b', candidate('b', 'only', 500, 3))
			],
			100000
		);

		expect(picked(result)).toContain('better');
	});

	it('refuses that candidate once it stops fitting', () => {
		const result = optimizeLoadout(
			[
				pool('a', candidate('a', 'ok', 1000, 3), candidate('a', 'better', 9000, 5)),
				pool('b', candidate('b', 'only', 500, 3))
			],
			// Exactly one cent short of the better combination.
			9499
		);

		expect(picked(result)).toEqual(['ok', 'only']);
	});

	it('accepts a combination that costs exactly the budget', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'one', 5000, 3)), pool('b', candidate('b', 'two', 5000, 3))],
			10000
		);

		expect(result.ok).toBe(true);
		expect(result.ok && result.totalMinor).toBe(10000);
	});

	it('rejects a combination one cent over the budget', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'one', 5000, 3)), pool('b', candidate('b', 'two', 5001, 3))],
			10000
		);

		expect(result).toEqual({ ok: false, reason: 'budget-too-low', minimumMinor: 10001 });
	});

	it('spends less when the match is equally good — budget is a ceiling', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'dear', 9000, 3), candidate('a', 'cheap', 1000, 3))],
			100000
		);

		expect(picked(result)).toEqual(['cheap']);
		expect(result.ok && result.totalMinor).toBe(1000);
	});

	it('balances across entries rather than spending everything on the first', () => {
		// A greedy pass would take the 5-score rifle and leave nothing for the
		// pistol; the right answer trades a little match for completeness.
		const result = optimizeLoadout(
			[
				pool('rifle', candidate('rifle', 'grand', 9000, 5), candidate('rifle', 'decent', 4000, 3)),
				pool('pistol', candidate('pistol', 'fine', 4000, 4), candidate('pistol', 'poor', 500, 1))
			],
			9000
		);

		expect(result.ok).toBe(true);
		expect(picked(result)).toEqual(['decent', 'fine']);
		expect(result.ok && result.visualScore).toBe(7);
	});
});

describe('failing', () => {
	it('names the entry with no candidates', () => {
		const result = optimizeLoadout(
			[pool('a', candidate('a', 'one', 100, 3)), pool('empty')],
			100000
		);

		expect(result).toEqual({ ok: false, reason: 'no-candidates', entryId: 'empty' });
	});

	it('reports the honest minimum when the budget is too low', () => {
		const result = optimizeLoadout(
			[
				pool('a', candidate('a', 'cheapest', 1500, 1), candidate('a', 'nicer', 8000, 5)),
				pool('b', candidate('b', 'cheapest', 2500, 1))
			],
			1000
		);

		expect(result).toEqual({ ok: false, reason: 'budget-too-low', minimumMinor: 4000 });
	});

	it('refuses to add quotes in different currencies', () => {
		const result = optimizeLoadout(
			[
				pool('a', candidate('a', 'one', 1000, 3)),
				pool('b', candidate('b', 'two', 1000, 3, { currency: 'USD' }))
			],
			100000
		);

		expect(result).toEqual({ ok: false, reason: 'currency-mismatch' });
	});

	it('refuses an empty core', () => {
		expect(optimizeLoadout([], 100000).ok).toBe(false);
	});
});

describe('determinism', () => {
	it('returns the same loadout for the same input', () => {
		const pools = [
			pool('a', candidate('a', 'x', 1000, 3), candidate('a', 'y', 1000, 3)),
			pool('b', candidate('b', 'p', 500, 2), candidate('b', 'q', 500, 2))
		];

		expect(picked(optimizeLoadout(pools, 100000))).toEqual(picked(optimizeLoadout(pools, 100000)));
	});

	it('breaks an exact tie on canonical identity, not on iteration order', () => {
		const forwards = optimizeLoadout(
			[pool('a', candidate('a', 'zulu', 1000, 3), candidate('a', 'alpha', 1000, 3))],
			100000
		);
		const backwards = optimizeLoadout(
			[pool('a', candidate('a', 'alpha', 1000, 3), candidate('a', 'zulu', 1000, 3))],
			100000
		);

		expect(picked(forwards)).toEqual(['alpha']);
		expect(picked(backwards)).toEqual(['alpha']);
	});

	it('does not mutate the pools it was given', () => {
		const pools = [
			pool('a', candidate('a', 'x', 1000, 3), candidate('a', 'y', 2000, 5)),
			pool('b', candidate('b', 'p', 500, 2))
		];
		const snapshot = structuredClone(pools);

		optimizeLoadout(pools, 100000);

		expect(pools).toEqual(snapshot);
	});
});

describe('minimumTotal', () => {
	it('adds the cheapest candidate from each entry', () => {
		expect(
			minimumTotal([
				pool('a', candidate('a', 'x', 1000, 1), candidate('a', 'y', 400, 5)),
				pool('b', candidate('b', 'p', 250, 1))
			])
		).toBe(650);
	});
});

/**
 * The optimizer, checked against the answer by definition.
 *
 * The exhaustive version enumerates every combination — exactly what the
 * frontier exists to avoid. On four entries with up to four candidates that is
 * at most 256 combinations, cheap here, and it settles whether the pruning is
 * genuinely safe or merely plausible.
 */
function exhaustive(
	pools: CandidatePool[],
	budgetMinor: number
): { score: number; total: number } | undefined {
	let best: { score: number; total: number } | undefined;

	function walk(index: number, total: number, score: number): void {
		if (total > budgetMinor) return;

		if (index === pools.length) {
			if (!best || score > best.score || (score === best.score && total < best.total)) {
				best = { score, total };
			}

			return;
		}

		for (const option of pools[index].candidates) {
			walk(index + 1, total + option.priceMinor, score + option.visualScore);
		}
	}

	walk(0, 0, 0);

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

describe('exactness', () => {
	it('matches exhaustive search on randomised cores', () => {
		for (let seed = 1; seed <= 120; seed++) {
			const random = makeRandom(seed);
			const entryCount = 2 + Math.floor(random() * 3);
			const pools: CandidatePool[] = [];

			for (let entry = 0; entry < entryCount; entry++) {
				const count = 2 + Math.floor(random() * 3);
				const candidates = Array.from({ length: count }, (_, index) =>
					candidate(
						`e${entry}`,
						`s${entry}-${index}`,
						100 + Math.floor(random() * 5000),
						Math.floor(random() * 6)
					)
				);

				pools.push({ entryId: `e${entry}`, candidates });
			}

			// A budget that bites: between the cheapest combination and the
			// most expensive one, so the constraint is doing work.
			const cheapest = minimumTotal(pools);
			const dearest = pools.reduce(
				(sum, entry) => sum + Math.max(...entry.candidates.map((option) => option.priceMinor)),
				0
			);
			const budget = cheapest + Math.floor(random() * Math.max(1, dearest - cheapest));

			const result = optimizeLoadout(pools, budget);
			const truth = exhaustive(pools, budget);

			expect(result.ok, `seed ${seed}`).toBe(true);
			expect(result.ok && result.visualScore, `seed ${seed} score`).toBe(truth?.score);
			expect(result.ok && result.totalMinor, `seed ${seed} total`).toBe(truth?.total);
		}
	});

	it('matches exhaustive search when budgets are tight', () => {
		// Where pruning is most likely to discard something that mattered.
		for (let seed = 500; seed <= 600; seed++) {
			const random = makeRandom(seed);
			const pools: CandidatePool[] = Array.from({ length: 4 }, (_, entry) => ({
				entryId: `e${entry}`,
				candidates: Array.from({ length: 4 }, (_, index) =>
					candidate(
						`e${entry}`,
						`s${entry}-${index}`,
						100 + Math.floor(random() * 900),
						Math.floor(random() * 6)
					)
				)
			}));

			const cheapest = minimumTotal(pools);
			const budget = cheapest + Math.floor(random() * 400);

			const result = optimizeLoadout(pools, budget);
			const truth = exhaustive(pools, budget);

			expect(result.ok && result.visualScore, `seed ${seed} score`).toBe(truth?.score);
			expect(result.ok && result.totalMinor, `seed ${seed} total`).toBe(truth?.total);
		}
	});
});
