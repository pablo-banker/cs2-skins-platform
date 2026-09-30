/**
 * Discovery: catalog skins joined with our curated visual metadata, plus the
 * pure primitives that future Explore, Kits and Smart Loadout screens will
 * filter and rank with.
 *
 * Two data layers meet here and the split matters:
 *
 * ```text
 * CS2Cap  → weapon, wear, rarity, collection, StatTrak, Souvenir   (objective)
 * ours    → colours, styles                                        (curated)
 * ```
 *
 * CS2Cap is never asked for a `color` or `style` parameter — it has no such
 * concept, and pretending otherwise would put our judgement in someone else's
 * API. Objective filters narrow upstream; visual filters narrow here.
 *
 * **Nothing in this module fetches anything.** No prices, no providers, no
 * network. Visual discovery has to stay cheap enough to run over a whole page
 * of results, and prices arrive later, only where a screen actually shows them.
 */
import type { Skin } from '$lib/types/skin';
import type {
	DiscoverableSkin,
	SkinColor,
	SkinStyle,
	SkinVisualProfile
} from '$lib/types/visual-metadata';
import { getVisualProfile } from './visual-metadata';

/** Whether a selection means "any of these" or "all of these". */
export type VisualMatchMode = 'any' | 'all';

/**
 * Which colours count as a match.
 *
 * `any` looks at primary and secondary; `primary` demands the colour actually
 * defines the skin. A visitor browsing "red" wants red AKs, not black AKs with
 * a red stripe — but a Smart Loadout building around red will happily take
 * both.
 */
export type ColorMatchScope = 'any' | 'primary';

export type VisualCriteria = {
	colors?: SkinColor[];
	/** Defaults to `any`. */
	colorMode?: VisualMatchMode;
	/** Defaults to `any`. */
	colorScope?: ColorMatchScope;
	styles?: SkinStyle[];
	/** Defaults to `any`. */
	styleMode?: VisualMatchMode;
};

/**
 * Attaches curated metadata to a catalog skin.
 *
 * A skin with no curation gets `visual: null` and stays in the result. Most of
 * the catalog is uncurated and will be for a long time; dropping those would
 * mean the catalog shrinks as a side effect of our own backlog.
 */
export function enrichSkin(skin: Skin): DiscoverableSkin {
	return { ...skin, visual: getVisualProfile(skin.weapon, skin.name) };
}

export function enrichSkins(skins: readonly Skin[]): DiscoverableSkin[] {
	return skins.map(enrichSkin);
}

/** The colours that count, given the scope. */
function colorsInScope(profile: SkinVisualProfile, scope: ColorMatchScope): SkinColor[] {
	return scope === 'primary'
		? profile.primaryColors
		: [...profile.primaryColors, ...profile.secondaryColors];
}

function matches<T>(available: readonly T[], selected: readonly T[], mode: VisualMatchMode) {
	return mode === 'all'
		? selected.every((value) => available.includes(value))
		: selected.some((value) => available.includes(value));
}

/**
 * Does this profile match the colour selection?
 *
 * An empty selection matches everything — "no filter" is not "no results".
 */
export function matchesColors(
	profile: SkinVisualProfile | null,
	colors: readonly SkinColor[],
	options: { mode?: VisualMatchMode; scope?: ColorMatchScope } = {}
): boolean {
	if (colors.length === 0) return true;
	if (!profile) return false;

	return matches(colorsInScope(profile, options.scope ?? 'any'), colors, options.mode ?? 'any');
}

export function matchesStyles(
	profile: SkinVisualProfile | null,
	styles: readonly SkinStyle[],
	options: { mode?: VisualMatchMode } = {}
): boolean {
	if (styles.length === 0) return true;
	if (!profile) return false;

	return matches(profile.styles, styles, options.mode ?? 'any');
}

/** Keeps the skins whose curation matches the selected colours. */
export function filterByColors<T extends { visual: SkinVisualProfile | null }>(
	skins: readonly T[],
	colors: readonly SkinColor[],
	options: { mode?: VisualMatchMode; scope?: ColorMatchScope } = {}
): T[] {
	return skins.filter((skin) => matchesColors(skin.visual, colors, options));
}

/** Keeps the skins whose curation matches the selected styles. */
export function filterByStyles<T extends { visual: SkinVisualProfile | null }>(
	skins: readonly T[],
	styles: readonly SkinStyle[],
	options: { mode?: VisualMatchMode } = {}
): T[] {
	return skins.filter((skin) => matchesStyles(skin.visual, styles, options));
}

/**
 * Applies colour and style criteria together.
 *
 * Criteria combine with AND: selecting "red" and "clean" means red *and*
 * clean. The mode options control how multiple values *within* one criterion
 * combine. With no criteria at all, everything comes back — including
 * uncurated skins, which only disappear once a visual filter is actually
 * applied.
 */
export function filterByVisual<T extends { visual: SkinVisualProfile | null }>(
	skins: readonly T[],
	criteria: VisualCriteria = {}
): T[] {
	const colors = criteria.colors ?? [];
	const styles = criteria.styles ?? [];

	if (colors.length === 0 && styles.length === 0) return [...skins];

	return skins.filter(
		(skin) =>
			matchesColors(skin.visual, colors, {
				mode: criteria.colorMode,
				scope: criteria.colorScope
			}) && matchesStyles(skin.visual, styles, { mode: criteria.styleMode })
	);
}

/**
 * Relevance weights for {@link visualMatchScore}.
 *
 * Small integers, not percentages, and ordered so the ranking is arguable in
 * one sentence: a colour that defines the skin beats a style, which beats a
 * colour that merely appears on it. They exist to break ties in a list, not to
 * be shown to anyone as a "match %".
 */
export const VISUAL_MATCH_WEIGHTS = {
	primaryColor: 3,
	style: 2,
	secondaryColor: 1
} as const;

/**
 * Scores how well a skin's curation fits a set of criteria.
 *
 * Deterministic and additive: every selected colour that appears as a primary
 * colour adds 3, as a secondary colour adds 1, and every selected style that
 * matches adds 2. Uncurated skins score 0 — they are not penalised, they are
 * simply unranked.
 *
 * This is a sorting aid. It is **not** the Smart Loadout algorithm, which has
 * to weigh budget, weapon coverage and user priorities, and will be designed
 * when it is built.
 */
export function visualMatchScore(
	profile: SkinVisualProfile | null,
	criteria: VisualCriteria = {}
): number {
	if (!profile) return 0;

	let score = 0;

	for (const color of criteria.colors ?? []) {
		if (profile.primaryColors.includes(color)) score += VISUAL_MATCH_WEIGHTS.primaryColor;
		else if (profile.secondaryColors.includes(color)) score += VISUAL_MATCH_WEIGHTS.secondaryColor;
	}

	for (const style of criteria.styles ?? []) {
		if (profile.styles.includes(style)) score += VISUAL_MATCH_WEIGHTS.style;
	}

	return score;
}

/**
 * Orders skins by how well they fit the criteria, best first.
 *
 * Ties keep their incoming order, so upstream relevance survives.
 */
export function rankByVisualMatch<T extends { visual: SkinVisualProfile | null }>(
	skins: readonly T[],
	criteria: VisualCriteria = {}
): T[] {
	return skins
		.map((skin, index) => ({ skin, index, score: visualMatchScore(skin.visual, criteria) }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((entry) => entry.skin);
}
