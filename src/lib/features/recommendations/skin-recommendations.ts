/**
 * Picking what to recommend beside a skin.
 *
 * Two questions, deliberately answered by two functions:
 *
 * ```text
 * Similar skins      same Builder slot   "another one of these, but ..."
 * Matches this skin  other slots         "what else goes with this?"
 * ```
 *
 * Collapsing them would produce the failure this file exists to avoid — six AK
 * alternatives under a heading promising a loadout that pairs with the AK.
 *
 * Pure: skins in, recommendations out. The candidate pool is handed in already
 * enriched, so nothing here reads the catalog, the dataset or the network.
 */
import { slotForSkin } from '$lib/config/loadout';
import { resolveVariant } from '$lib/features/skins/variant-selection';
import { MIN_VISUAL_SIMILARITY_SCORE, visualSimilarity } from './visual-similarity';
import type { SkinVariant } from '$lib/types/skin';
import type { DiscoverableSkin, SkinColor, SkinStyle } from '$lib/types/visual-metadata';

/** How many same-slot alternatives a skin page shows. */
export const SIMILAR_LIMIT = 4;

/** How many cross-slot pairings a skin page shows. */
export const MATCH_LIMIT = 6;

/**
 * One recommendation, at product level.
 *
 * Identity is the canonical route slug — never an item id, a wear or an
 * edition. A recommendation is "this skin", not "this listing", so it opens the
 * skin page and lets that page resolve its own default variant.
 *
 * `variant` is the representative one, carried for the card's image and wear
 * badge only. `matchedColors` and `matchedStyles` are the evidence behind the
 * score, kept so a reason can be shown without recomputing it.
 */
export type SkinRecommendation = {
	skin: DiscoverableSkin;
	variant: SkinVariant;
	/** Canonical route slug — the same one Explore and search use. */
	slug: string;
	/** Internal ranking signal. Not a percentage, and never rendered. */
	similarityScore: number;
	matchedColors: SkinColor[];
	matchedStyles: SkinStyle[];
	/** Builder slot this skin belongs to, which is what makes matches diverse. */
	slotId: string;
};

type Scored = SkinRecommendation;

/**
 * Scores one candidate, or rejects it.
 *
 * Rejected when it is the source, has no Builder slot, has no variant to show,
 * or does not reach {@link MIN_VISUAL_SIMILARITY_SCORE}. **There is no
 * fallback and no dynamic threshold**: a skin that merely shares a trim colour
 * is not a weak recommendation, it is a different skin we happen to have
 * curated.
 */
function score(source: DiscoverableSkin, candidate: DiscoverableSkin): Scored | undefined {
	if (candidate.id === source.id) return undefined;

	const slot = slotForSkin(candidate);
	if (!slot) return undefined;

	const {
		score: similarityScore,
		matchedColors,
		matchedStyles
	} = visualSimilarity(source.visual, candidate.visual);

	if (similarityScore < MIN_VISUAL_SIMILARITY_SCORE) return undefined;

	// The card needs something to show. Every catalog skin has variants; a
	// candidate without one would render an empty cell.
	const variant = resolveVariant(candidate);
	if (!variant) return undefined;

	return {
		skin: candidate,
		variant,
		slug: candidate.id,
		similarityScore,
		matchedColors,
		matchedStyles,
		slotId: slot.id
	};
}

/**
 * Best first, then canonical slug.
 *
 * The slug tie-break is what makes repeated page loads identical: two skins
 * that score the same must not swap places because the catalog came back in a
 * different order.
 */
function rank(a: Scored, b: Scored): number {
	return b.similarityScore - a.similarityScore || a.slug.localeCompare(b.slug);
}

/**
 * Every eligible candidate, best first.
 *
 * The one place a `SkinRecommendation` is built and ranked. Similar skins,
 * Matches this skin and the Knife + Gloves matcher all narrow *this* list
 * rather than scoring again — three surfaces disagreeing about what "matches"
 * means would be worse than any of them being slightly wrong.
 */
export function rankedRecommendations(
	source: DiscoverableSkin,
	candidates: readonly DiscoverableSkin[]
): SkinRecommendation[] {
	return scoreAll(source, candidates);
}

function scoreAll(source: DiscoverableSkin, candidates: readonly DiscoverableSkin[]): Scored[] {
	return candidates
		.map((candidate) => score(source, candidate))
		.filter((entry): entry is Scored => entry !== undefined)
		.sort(rank);
}

/**
 * Other skins for the same thing, that look like this one.
 *
 * "Same thing" is the **Builder slot**, not the base name. For a firearm those
 * are identical — one slot per weapon — but for a knife or a pair of gloves the
 * slot is the family, so a Karambit is recommended alongside a Bayonet. That is
 * what someone shopping for a knife means, and it falls out of the registry
 * rather than out of parsing names.
 *
 * A source with no curation, or no slot of its own, gets nothing.
 */
export function similarSkins(
	source: DiscoverableSkin,
	candidates: readonly DiscoverableSkin[],
	limit: number = SIMILAR_LIMIT
): SkinRecommendation[] {
	const sourceSlot = slotForSkin(source);
	if (!sourceSlot || !source.visual) return [];

	return scoreAll(source, candidates)
		.filter((entry) => entry.slotId === sourceSlot.id)
		.slice(0, limit);
}

/**
 * Skins for *other* slots that pair with this one.
 *
 * Ranked by similarity, then filled **one slot at a time**: the best candidate
 * from each distinct slot is taken before any slot gets a second. A plain
 * top-six would return six USP-S finishes for a red AK, which is a worse answer
 * than a pistol, a rifle, a sniper, a knife and gloves — and the same-weapon
 * answer already has its own section.
 *
 * Duplicates are only a fallback for when there are not enough slots with a
 * verified match. Nothing is invented to reach the limit; fewer is correct.
 */
export function matchingSkins(
	source: DiscoverableSkin,
	candidates: readonly DiscoverableSkin[],
	limit: number = MATCH_LIMIT
): SkinRecommendation[] {
	if (!source.visual) return [];

	const sourceSlot = slotForSkin(source);
	const crossSlot = scoreAll(source, candidates).filter((entry) => entry.slotId !== sourceSlot?.id);

	const picked: SkinRecommendation[] = [];
	const usedSlots = new Set<string>();

	// First pass: breadth. Already ranked, so this is the best of each slot.
	for (const entry of crossSlot) {
		if (picked.length >= limit) break;
		if (usedSlots.has(entry.slotId)) continue;

		usedSlots.add(entry.slotId);
		picked.push(entry);
	}

	// Second pass: depth, only once every slot has had a turn.
	if (picked.length < limit) {
		const taken = new Set(picked.map((entry) => entry.slug));

		for (const entry of crossSlot) {
			if (picked.length >= limit) break;
			if (taken.has(entry.slug)) continue;

			picked.push(entry);
		}
	}

	return picked;
}
