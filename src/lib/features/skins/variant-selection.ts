/**
 * Resolving a URL selection to one real variant, and building the URLs that
 * select the others.
 *
 * Pure: no fetching, no mutation, and every result comes from the variants the
 * grouped skin actually has — a selector can never offer something that cannot
 * be bought or link to a variant that does not exist.
 */
import { WEAR_ORDER, type SkinEdition, type SkinSelection } from '$lib/schemas/skin-detail';

const wearRank = new Map<string, number>(WEAR_ORDER.map((wear, index) => [wear, index]));

/**
 * The part of a variant that choosing between variants actually depends on.
 *
 * `SkinVariant` satisfies this, and so does the narrower option shape the
 * loadout picker sends to the browser — which is the point. Deciding which
 * exterior a selection means has never involved a market hash name or a float
 * range, so the logic does not ask for them, and the builder reuses this
 * resolution rather than growing a second copy of it.
 */
export type VariantChoice = {
	itemId: number;
	wear?: string;
	statTrak: boolean;
	souvenir: boolean;
	phase?: string;
};

/** Anything that carries a set of variants to choose between. */
type HasVariants<V extends VariantChoice> = { variants: readonly V[] };

/** The edition a variant belongs to. */
export function variantEdition(variant: VariantChoice): SkinEdition {
	if (variant.statTrak) return 'stattrak';
	if (variant.souvenir) return 'souvenir';

	return 'normal';
}

/**
 * Orders variants the way a person would choose between them: plain first,
 * then best condition, with the catalog id as a stable tiebreak.
 */
function compareVariants(a: VariantChoice, b: VariantChoice): number {
	const editionRank = (variant: VariantChoice) => (variant.statTrak ? 1 : variant.souvenir ? 2 : 0);

	const wearValue = (variant: VariantChoice) =>
		variant.wear ? (wearRank.get(variant.wear) ?? WEAR_ORDER.length) : -1;

	return editionRank(a) - editionRank(b) || wearValue(a) - wearValue(b) || a.itemId - b.itemId;
}

/** Every variant, in the order the selectors present them. */
export function orderedVariants<V extends VariantChoice>(skin: HasVariants<V>): V[] {
	return [...skin.variants].sort(compareVariants);
}

/**
 * The variant a selection refers to.
 *
 * An exact match wins. Anything unspecified or unavailable relaxes one
 * constraint at a time — phase, then wear, then edition — rather than giving
 * up, so a link to a StatTrak Factory New that does not exist still lands on
 * the closest real thing instead of a dead page.
 *
 * Returns `undefined` only for a skin with no variants at all.
 */
export function resolveVariant<V extends VariantChoice>(
	skin: HasVariants<V>,
	selection: SkinSelection = {}
): V | undefined {
	const ordered = orderedVariants(skin);
	if (ordered.length === 0) return undefined;

	const matches = (variant: V, constraints: SkinSelection) =>
		(!constraints.wear || variant.wear === constraints.wear) &&
		(!constraints.edition || variantEdition(variant) === constraints.edition) &&
		(!constraints.phase || variant.phase === constraints.phase);

	// Most specific first; each step drops the least important constraint.
	const attempts: SkinSelection[] = [
		selection,
		{ wear: selection.wear, edition: selection.edition },
		{ edition: selection.edition },
		{ wear: selection.wear },
		{}
	];

	for (const constraints of attempts) {
		const found = ordered.find((variant) => matches(variant, constraints));
		if (found) return found;
	}

	return ordered[0];
}

/** The exteriors this skin is sold in, in condition order. */
export function availableWears(skin: HasVariants<VariantChoice>, edition?: SkinEdition): string[] {
	const wears = skin.variants
		.filter((variant) => !edition || variantEdition(variant) === edition)
		.map((variant) => variant.wear)
		.filter((wear): wear is string => Boolean(wear));

	return [...new Set(wears)].sort(
		(a, b) => (wearRank.get(a) ?? WEAR_ORDER.length) - (wearRank.get(b) ?? WEAR_ORDER.length)
	);
}

/** The editions this skin is sold in, plain first. */
export function availableEditions(skin: HasVariants<VariantChoice>): SkinEdition[] {
	const editions = new Set(skin.variants.map(variantEdition));

	return (['normal', 'stattrak', 'souvenir'] as const).filter((edition) => editions.has(edition));
}

/** The phases available, for phased finishes. Empty for everything else. */
export function availablePhases(skin: HasVariants<VariantChoice>, edition?: SkinEdition): string[] {
	const phases = skin.variants
		.filter((variant) => !edition || variantEdition(variant) === edition)
		.map((variant) => variant.phase)
		.filter((phase): phase is string => Boolean(phase));

	return [...new Set(phases)].sort((a, b) => a.localeCompare(b));
}

/**
 * The query string for a variant selection, on its own.
 *
 * The one place variant query parameters are written. Anything holding a
 * `SkinSelection` and no catalog — a recommendation card, a matcher result —
 * links through this rather than assembling `?wear=` by hand, so the vocabulary
 * cannot drift between the page that writes a link and the page that reads it.
 *
 * Unlike {@link skinVariantSearch} it cannot know what the skin's default
 * variant is, so it emits whatever it is given. That is the right behaviour for
 * a caller that means *this exact variant* — a matcher preserving the exterior
 * someone chose, rather than a selector tidying a URL back to the product page.
 *
 * Built as a string because a `URLSearchParams` inside a Svelte `$derived` is a
 * mutable non-reactive object, which the project's lint rules reject.
 */
export function variantSearch(selection: SkinSelection): string {
	const params: string[] = [];

	if (selection.wear) params.push(`wear=${encodeURIComponent(selection.wear)}`);
	// `normal` is the default, so saying it adds noise without adding meaning.
	if (selection.edition && selection.edition !== 'normal') {
		params.push(`edition=${encodeURIComponent(selection.edition)}`);
	}
	if (selection.phase) params.push(`phase=${encodeURIComponent(selection.phase)}`);

	return params.length > 0 ? `?${params.join('&')}` : '';
}

/**
 * The URL that selects a variant of a known skin.
 *
 * Built in one place so the exterior, edition and phase controls cannot drift
 * apart, and so a default selection produces a clean product URL rather than
 * one cluttered with the values it would have chosen anyway.
 */
export function skinVariantSearch(
	skin: HasVariants<VariantChoice>,
	selection: SkinSelection
): string {
	const resolved = resolveVariant(skin, selection);
	if (!resolved) return '';

	// A link to the default variant is a link to the product.
	if (resolved.itemId === resolveVariant(skin, {})?.itemId) return '';

	return variantSearch({
		wear: resolved.wear,
		edition: variantEdition(resolved),
		phase: resolved.phase
	});
}
