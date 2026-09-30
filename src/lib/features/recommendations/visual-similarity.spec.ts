import { describe, expect, it } from 'vitest';
import { visualSimilarity, VISUAL_SIMILARITY_WEIGHTS } from './visual-similarity';
import type { SkinVisualProfile } from '$lib/types/visual-metadata';

function profile(overrides: Partial<SkinVisualProfile> = {}): SkinVisualProfile {
	return { primaryColors: [], secondaryColors: [], styles: [], ...overrides };
}

const W = VISUAL_SIMILARITY_WEIGHTS;

describe('what a shared colour is worth', () => {
	it('scores a colour that defines both skins highest', () => {
		const result = visualSimilarity(
			profile({ primaryColors: ['red'] }),
			profile({ primaryColors: ['red'] })
		);

		expect(result.score).toBe(W.primaryToPrimary);
		expect(result.matchedColors).toEqual(['red']);
	});

	it('halves it when the colour only supports one of them', () => {
		const sourceDefines = visualSimilarity(
			profile({ primaryColors: ['red'] }),
			profile({ secondaryColors: ['red'] })
		);
		const candidateDefines = visualSimilarity(
			profile({ secondaryColors: ['red'] }),
			profile({ primaryColors: ['red'] })
		);

		expect(sourceDefines.score).toBe(W.primaryToSecondary);
		expect(candidateDefines.score).toBe(W.secondaryToPrimary);
	});

	it('barely registers a colour that supports both', () => {
		const result = visualSimilarity(
			profile({ secondaryColors: ['red'] }),
			profile({ secondaryColors: ['red'] })
		);

		expect(result.score).toBe(W.secondaryToSecondary);
	});

	it('scores nothing for a colour only one of them has', () => {
		const result = visualSimilarity(
			profile({ primaryColors: ['red'] }),
			profile({ primaryColors: ['blue'] })
		);

		expect(result).toEqual({ score: 0, matchedColors: [], matchedStyles: [] });
	});

	it('orders the strengths the way the model claims', () => {
		expect(W.primaryToPrimary).toBeGreaterThan(W.primaryToSecondary);
		expect(W.primaryToSecondary).toBe(W.secondaryToPrimary);
		expect(W.secondaryToPrimary).toBeGreaterThan(W.secondaryToSecondary);
	});
});

describe('styles', () => {
	it('scores a shared style', () => {
		const result = visualSimilarity(profile({ styles: ['dark'] }), profile({ styles: ['dark'] }));

		expect(result.score).toBe(W.sharedStyle);
		expect(result.matchedStyles).toEqual(['dark']);
	});

	it('scores nothing for a style only one of them has', () => {
		expect(
			visualSimilarity(profile({ styles: ['dark'] }), profile({ styles: ['clean'] })).score
		).toBe(0);
	});

	it('adds up across several shared styles', () => {
		const result = visualSimilarity(
			profile({ styles: ['dark', 'minimal'] }),
			profile({ styles: ['dark', 'minimal', 'military'] })
		);

		expect(result.score).toBe(W.sharedStyle * 2);
		expect(result.matchedStyles).toEqual(['minimal', 'dark']);
	});

	it('ranks below a defining colour, above nothing', () => {
		// The ordering the model is arguing for: colour first, style next.
		expect(W.primaryToPrimary).toBeGreaterThan(W.sharedStyle);
		expect(W.sharedStyle).toBeGreaterThan(W.secondaryToSecondary);
	});
});

describe('combining evidence', () => {
	it('adds colours and styles together', () => {
		const result = visualSimilarity(
			profile({ primaryColors: ['red'], secondaryColors: ['black'], styles: ['dark'] }),
			profile({ primaryColors: ['red'], secondaryColors: ['black'], styles: ['dark'] })
		);

		expect(result.score).toBe(W.primaryToPrimary + W.secondaryToSecondary + W.sharedStyle);
		expect(result.matchedColors).toEqual(['black', 'red']);
		expect(result.matchedStyles).toEqual(['dark']);
	});

	it('beats a weaker overlap of the same shape', () => {
		const source = profile({ primaryColors: ['red'], styles: ['dark'] });

		const strong = visualSimilarity(source, profile({ primaryColors: ['red'], styles: ['dark'] }));
		const weaker = visualSimilarity(source, profile({ secondaryColors: ['red'] }));

		expect(strong.score).toBeGreaterThan(weaker.score);
	});

	it('counts a colour once, at its strongest pairing', () => {
		// A record should not list a colour twice, but an odd one must not
		// score double for it.
		const result = visualSimilarity(
			profile({ primaryColors: ['red'], secondaryColors: ['red'] }),
			profile({ primaryColors: ['red'], secondaryColors: ['red'] })
		);

		expect(result.score).toBe(W.primaryToPrimary);
		expect(result.matchedColors).toEqual(['red']);
	});
});

describe('the shape of the function', () => {
	it('is symmetric — "looks like" goes both ways', () => {
		const a = profile({ primaryColors: ['red'], secondaryColors: ['black'], styles: ['dark'] });
		const b = profile({ primaryColors: ['black'], secondaryColors: ['red'], styles: ['dark'] });

		expect(visualSimilarity(a, b).score).toBe(visualSimilarity(b, a).score);
	});

	it('reports evidence in taxonomy order, not record order', () => {
		// Two records written in different orders must produce the same answer.
		const written = visualSimilarity(
			profile({ primaryColors: ['red', 'black', 'blue'] }),
			profile({ primaryColors: ['blue', 'red', 'black'] })
		);

		expect(written.matchedColors).toEqual(['black', 'red', 'blue']);
	});

	it('scores an uncurated skin zero on either side', () => {
		const curated = profile({ primaryColors: ['red'] });

		expect(visualSimilarity(null, curated).score).toBe(0);
		expect(visualSimilarity(curated, null).score).toBe(0);
		expect(visualSimilarity(null, null).score).toBe(0);
	});

	it('scores two empty profiles zero rather than treating emptiness as agreement', () => {
		expect(visualSimilarity(profile(), profile()).score).toBe(0);
	});

	it('does not mutate what it was given', () => {
		const source = profile({ primaryColors: ['red'], styles: ['dark'] });
		const candidate = profile({ primaryColors: ['red'], styles: ['dark'] });
		const before = structuredClone([source, candidate]);

		visualSimilarity(source, candidate);

		expect([source, candidate]).toEqual(before);
	});
});
