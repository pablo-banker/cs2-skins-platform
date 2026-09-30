/**
 * Picking the variant a browse card represents.
 *
 * A skin has around eleven variants; a card shows one. The choice has to be
 * deterministic, or the same skin would show a different exterior on every
 * render and the grid would look unstable.
 */
import type { SkinVariant } from '$lib/types/skin';

/**
 * Exterior preference, best condition first.
 *
 * Not every skin supports every exterior — `AK-47 | Redline` has no Factory
 * New — so this is a preference order to walk, not an expectation.
 */
export const WEAR_PREFERENCE = [
	'Factory New',
	'Minimal Wear',
	'Field-Tested',
	'Well-Worn',
	'Battle-Scarred'
] as const;

const wearRank = new Map<string, number>(WEAR_PREFERENCE.map((wear, index) => [wear, index]));

/** Plain variants first, then StatTrak, then Souvenir; best exterior within each. */
function score(variant: SkinVariant): [number, number, number] {
	const special = variant.statTrak ? 1 : variant.souvenir ? 2 : 0;
	const wear = variant.wear ? (wearRank.get(variant.wear) ?? WEAR_PREFERENCE.length) : -1;

	return [special, wear, variant.itemId];
}

/**
 * The variant a card should show.
 *
 * Prefers an ordinary variant — a card labelled StatTrak when a plain version
 * exists misrepresents the skin and its price. Falls back through the exterior
 * preference, and if a skin only has special variants, picks the best of those
 * rather than showing nothing. Ties break on `itemId` so the result is stable.
 *
 * Pure: the input array is never reordered.
 */
export function pickRepresentativeVariant(
	variants: readonly SkinVariant[]
): SkinVariant | undefined {
	if (variants.length === 0) return undefined;

	return [...variants].sort((a, b) => {
		const [aSpecial, aWear, aId] = score(a);
		const [bSpecial, bWear, bId] = score(b);

		return aSpecial - bSpecial || aWear - bWear || aId - bId;
	})[0];
}
