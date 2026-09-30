/**
 * Which exact version of a skin a feature should quote when nobody chose one.
 *
 * Anything that prices a *set* of skins has to commit to one variant each
 * before it can ask what they cost: pricing every exterior and edition of
 * every candidate multiplies a bounded shortlist into hundreds of market
 * lookups. So the choice is made here, deterministically, by policy rather
 * than by price.
 *
 * Shared on purpose. Smart Loadout and the Knife + Gloves matcher both need
 * "the version someone would actually buy", and two copies of this policy
 * would eventually disagree — the same skin would be quoted Field-Tested on
 * one page and Factory New on another.
 *
 * Pure. No catalog access, no mutation, no market data.
 */
import { variantEdition, type VariantChoice } from '$lib/features/skins/variant-selection';

/**
 * Exteriors in the order a practical default prefers them.
 *
 * Field-Tested first because it is the exterior most skins are actually
 * stocked in, and because defaulting to Factory New would quietly price
 * everything for collectors. **This is not a claim that Field-Tested is
 * cheapest** — it frequently is not. It is a practical, widely available
 * default, and the same one every time so a result can be reproduced.
 *
 * Battle-Scarred comes last despite usually being the cheapest: reaching for
 * the worst condition first would technically fit more budgets and produce
 * loadouts nobody wants.
 */
export const PRACTICAL_WEAR_PREFERENCE = [
	'Field-Tested',
	'Minimal Wear',
	'Well-Worn',
	'Factory New',
	'Battle-Scarred'
] as const;

const wearRank = new Map<string, number>(
	PRACTICAL_WEAR_PREFERENCE.map((wear, index) => [wear, index])
);

/**
 * The one variant to quote for this skin, or nothing.
 *
 * **Normal edition only.** StatTrak and Souvenir are premium choices somebody
 * makes on purpose; generating one would spend money on a preference nobody
 * expressed. A skin sold *only* as StatTrak or Souvenir therefore has no
 * practical variant at all, which is the honest answer.
 *
 * Finish-less products — a vanilla knife — have no exterior, and that is a
 * real variant rather than a gap. Nothing here invents a `Factory New` for
 * them.
 */
export function pickPracticalVariant<V extends VariantChoice>(skin: {
	variants: readonly V[];
}): V | undefined {
	const normal = skin.variants.filter((variant) => variantEdition(variant) === 'normal');
	if (normal.length === 0) return undefined;

	// Sorted rather than searched by preference, so a skin stocked only in
	// exteriors outside the list still resolves — to its lowest catalog id,
	// which is stable.
	return [...normal].sort((a, b) => {
		const rank = (variant: V) =>
			variant.wear ? (wearRank.get(variant.wear) ?? PRACTICAL_WEAR_PREFERENCE.length) : -1;

		return rank(a) - rank(b) || a.itemId - b.itemId;
	})[0];
}
