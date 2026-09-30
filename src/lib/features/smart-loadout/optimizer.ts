/**
 * Choosing the loadout.
 *
 * One candidate per Smart Core entry, the best visual match the budget allows.
 * Pure: integer minor units in, a selection out — no Svelte, no I/O, no
 * upstream types, and no randomness. The same candidates and the same budget
 * always produce the same loadout.
 */
import type { SmartCandidate } from '$lib/types/smart-loadout';

/** One entry's shortlist. Empty means the loadout cannot be completed. */
export type CandidatePool = {
	entryId: string;
	candidates: SmartCandidate[];
};

export type OptimizedLoadout = {
	picks: SmartCandidate[];
	totalMinor: number;
	/** Sum of `visualMatchScore` across the picks. Never shown as a number. */
	visualScore: number;
	currency: string;
};

export type OptimizeFailure =
	/** Some entry had no priceable candidate at all. */
	| { ok: false; reason: 'no-candidates'; entryId: string }
	/** Candidates exist, but no combination fits. `minimumMinor` is the floor. */
	| { ok: false; reason: 'budget-too-low'; minimumMinor: number }
	/** Quotes in more than one currency reached the optimizer. */
	| { ok: false; reason: 'currency-mismatch' };

export type OptimizeResult = ({ ok: true } & OptimizedLoadout) | OptimizeFailure;

/**
 * Canonical identity for a candidate, used only to break exact ties.
 *
 * Two loadouts that cost the same and match equally well are equally good
 * answers; this makes the generator pick the same one every time rather than
 * whichever the iteration order happened to reach first.
 */
function candidateKey(candidate: SmartCandidate): string {
	const { wear = '', edition = '', phase = '' } = candidate.variant;

	return `${candidate.entryId}|${candidate.slotId}|${candidate.skinSlug}|${wear}|${edition}|${phase}`;
}

type State = {
	totalMinor: number;
	visualScore: number;
	picks: SmartCandidate[];
	/** Concatenated candidate keys, so equal states order deterministically. */
	key: string;
};

/**
 * Drops states no optimal answer could be built from.
 *
 * A state is dominated when another costs no more and matches no worse — there
 * is then no budget and no preference under which the dominated one wins, so
 * carrying it forward only grows the search.
 *
 * This is what keeps the search small without indexing an array by budget:
 * a cents-indexed table over an arbitrary BRL budget would be millions of
 * entries, while the surviving frontier here is bounded by the number of
 * distinct visual scores — a few dozen at most.
 */
function prune(states: State[]): State[] {
	const sorted = [...states].sort(
		(a, b) =>
			a.totalMinor - b.totalMinor ||
			b.visualScore - a.visualScore ||
			(a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
	);

	const frontier: State[] = [];
	let bestScore = -Infinity;

	for (const state of sorted) {
		// Costs rise as we sweep, so a state is worth keeping only if it beats
		// everything cheaper on score. Equal score at higher cost is dominated;
		// equal score at equal cost is a tie already settled by the sort.
		if (state.visualScore > bestScore) {
			frontier.push(state);
			bestScore = state.visualScore;
		}
	}

	return frontier;
}

/**
 * The cheapest each entry can possibly be, added up.
 *
 * The honest floor for "this budget is too low": it is the minimum across the
 * **shortlist that was actually priced**, not across every skin in CS2, and
 * the copy that reports it says so.
 */
export function minimumTotal(pools: readonly CandidatePool[]): number {
	return pools.reduce(
		(sum, pool) => sum + Math.min(...pool.candidates.map((candidate) => candidate.priceMinor)),
		0
	);
}

/**
 * The best loadout the budget allows.
 *
 * Maximises total visual match; among equally good matches, prefers the
 * cheaper total. **Budget is a ceiling, not a target** — a loadout that
 * matches just as well for less money is strictly better, and the optimizer
 * never spends more merely because the money is there.
 *
 * Exact, not greedy. Picking each entry's best match in turn and hoping it
 * fits would blow the budget on the first slot and leave nothing for the rest;
 * picking the cheapest would ignore the preference entirely. The frontier
 * below keeps every trade-off that could still win.
 */
export function optimizeLoadout(
	pools: readonly CandidatePool[],
	budgetMinor: number
): OptimizeResult {
	const empty = pools.find((pool) => pool.candidates.length === 0);
	if (empty) return { ok: false, reason: 'no-candidates', entryId: empty.entryId };

	if (pools.length === 0) return { ok: false, reason: 'no-candidates', entryId: '' };

	const currencies = new Set(
		pools.flatMap((pool) => pool.candidates.map((candidate) => candidate.currency))
	);

	// One currency or no total. There is no FX anywhere in this product, and a
	// mixed sum would be wrong rather than merely missing.
	if (currencies.size !== 1) return { ok: false, reason: 'currency-mismatch' };

	const currency = [...currencies][0];
	const minimum = minimumTotal(pools);

	if (minimum > budgetMinor) return { ok: false, reason: 'budget-too-low', minimumMinor: minimum };

	let frontier: State[] = [{ totalMinor: 0, visualScore: 0, picks: [], key: '' }];

	for (const pool of pools) {
		const next: State[] = [];

		for (const state of frontier) {
			for (const candidate of pool.candidates) {
				const totalMinor = state.totalMinor + candidate.priceMinor;

				// Pruned as we go: a partial loadout already over budget can
				// never come back under it, since prices are positive.
				if (totalMinor > budgetMinor) continue;

				next.push({
					totalMinor,
					visualScore: state.visualScore + candidate.visualScore,
					picks: [...state.picks, candidate],
					key: `${state.key}${candidateKey(candidate)}\u0000`
				});
			}
		}

		frontier = prune(next);

		// Unreachable given the minimum check above, but the loop must not
		// depend on that to stay correct.
		if (frontier.length === 0)
			return { ok: false, reason: 'budget-too-low', minimumMinor: minimum };
	}

	// The frontier holds one state per achievable score, each at its lowest
	// cost, so the best answer is simply the highest score.
	const best = frontier.reduce((winner, state) =>
		state.visualScore > winner.visualScore ||
		(state.visualScore === winner.visualScore && state.totalMinor < winner.totalMinor)
			? state
			: winner
	);

	return {
		ok: true,
		picks: best.picks,
		totalMinor: best.totalMinor,
		visualScore: best.visualScore,
		currency
	};
}
