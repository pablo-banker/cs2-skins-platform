/**
 * How alike two skins look, according to what someone actually verified.
 *
 * **This is not `visualMatchScore`, and the difference is the point.**
 * `discovery.ts` answers _"how well does this skin fit a query?"_ — a flat list
 * of selected colours and styles, where anything the visitor did not ask for is
 * irrelevant. This answers _"how alike are these two skins?"_, where both sides
 * have structure: a colour that defines the source meeting a colour that
 * defines the candidate is a much stronger signal than two skins that happen to
 * share a trim colour. One score cannot carry both meanings, so there are two,
 * and neither is reused for the other's job.
 *
 * Everything here is pure and total: profiles in, a number out. No catalog, no
 * metadata lookup, no I/O.
 */
import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';
import type { SkinColor, SkinStyle, SkinVisualProfile } from '$lib/types/visual-metadata';

/**
 * Small integers, ordered so the ranking is arguable in one sentence.
 *
 * A colour that defines **both** skins is the strongest thing two skins can
 * share. A defining colour meeting a supporting one is worth half of that, in
 * either direction — the relation is symmetric, because "looks like" is. A
 * shared style sits alongside those, and two skins that merely share a trim
 * colour barely register.
 *
 * Five numbers, no tuning knobs. They break ties in a short list; they are not
 * a calibrated model and are never shown to anyone.
 */
export const VISUAL_SIMILARITY_WEIGHTS = {
	primaryToPrimary: 4,
	primaryToSecondary: 2,
	secondaryToPrimary: 2,
	sharedStyle: 2,
	secondaryToSecondary: 1
} as const;

/**
 * The weakest relationship still worth calling a match.
 *
 * Four is not arbitrary: it is exactly one colour that **defines both skins**,
 * and nothing below it clears that bar. A 2 is one skin's trim colour meeting
 * the other's main colour, or a lone shared style; a 1 is two trim colours. A
 * black-accented AK and a black-accented glove are not a pairing, they are two
 * skins that both have some black on them — and calling that "similar" teaches
 * people to ignore the section.
 *
 * Shared by every visual recommendation so the word means one thing across the
 * product: Similar skins, Matches this skin, and the Knife + Gloves matcher.
 * **Never lower it to fill a grid.** Fewer honest results beat a full screen of
 * filler; an empty section is a curation signal, not a layout problem.
 */
export const MIN_VISUAL_SIMILARITY_SCORE = 4;

export type VisualSimilarity = {
	/** Internal ranking signal. Never rendered — see `docs/RECOMMENDATIONS.md`. */
	score: number;
	/** Colours that actually contributed, in taxonomy order. */
	matchedColors: SkinColor[];
	/** Styles both skins carry, in taxonomy order. */
	matchedStyles: SkinStyle[];
};

const NO_SIMILARITY: VisualSimilarity = { score: 0, matchedColors: [], matchedStyles: [] };

/**
 * What one colour is worth across the two profiles.
 *
 * A record should not list the same colour as both primary and secondary, but
 * this takes the strongest applicable pairing rather than assuming it — an
 * unexpected record should rank oddly, not score twice.
 */
function colorWeight(
	source: SkinVisualProfile,
	candidate: SkinVisualProfile,
	color: SkinColor
): number {
	const sourcePrimary = source.primaryColors.includes(color);
	const sourceSecondary = source.secondaryColors.includes(color);
	const candidatePrimary = candidate.primaryColors.includes(color);
	const candidateSecondary = candidate.secondaryColors.includes(color);

	if (sourcePrimary && candidatePrimary) return VISUAL_SIMILARITY_WEIGHTS.primaryToPrimary;
	if (sourcePrimary && candidateSecondary) return VISUAL_SIMILARITY_WEIGHTS.primaryToSecondary;
	if (sourceSecondary && candidatePrimary) return VISUAL_SIMILARITY_WEIGHTS.secondaryToPrimary;
	if (sourceSecondary && candidateSecondary) return VISUAL_SIMILARITY_WEIGHTS.secondaryToSecondary;

	return 0;
}

/**
 * Scores two curated profiles against each other.
 *
 * Symmetric by construction, and zero whenever either side is uncurated — an
 * unclassified skin is not "dissimilar", it is unjudged, and the callers drop
 * anything scoring zero rather than ranking it last.
 *
 * Colours and styles are walked in taxonomy order, not in the order a record
 * happens to list them, so the returned evidence is stable however the dataset
 * was written.
 */
export function visualSimilarity(
	source: SkinVisualProfile | null,
	candidate: SkinVisualProfile | null
): VisualSimilarity {
	if (!source || !candidate) return NO_SIMILARITY;

	let score = 0;
	const matchedColors: SkinColor[] = [];
	const matchedStyles: SkinStyle[] = [];

	for (const color of SKIN_COLORS) {
		const weight = colorWeight(source, candidate, color);

		if (weight > 0) {
			score += weight;
			matchedColors.push(color);
		}
	}

	for (const style of SKIN_STYLES) {
		if (source.styles.includes(style) && candidate.styles.includes(style)) {
			score += VISUAL_SIMILARITY_WEIGHTS.sharedStyle;
			matchedStyles.push(style);
		}
	}

	return { score, matchedColors, matchedStyles };
}
