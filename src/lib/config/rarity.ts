/**
 * Rarity presentation.
 *
 * CS2 uses one colour ladder with a different set of names per item class —
 * a weapon's "Mil-Spec Grade", an agent's "Distinguished" and a collectible's
 * "High Grade" are all the same blue. This maps every name the catalog reports
 * onto our seven design-system rarity tokens, so components never reach for an
 * upstream hex value.
 *
 * The mapping was taken from the live catalog (`/items/metadata` for the
 * vocabulary, then the reported colour for each name), not from assumption.
 */
import type { SkinRarity } from '$lib/types/skin';

/** The seven tiers our design tokens cover. */
export type RarityTier =
	'consumer' | 'industrial' | 'mil-spec' | 'restricted' | 'classified' | 'covert' | 'contraband';

/**
 * Rarity name → tier. Keys are lowercased on lookup.
 *
 * Each group is one rung of the ladder: weapons, agents and collectibles use
 * different words for the same colour.
 */
const TIER_BY_NAME: Record<string, RarityTier> = {
	// b0c3d9
	'base grade': 'consumer',
	'consumer grade': 'consumer',
	consumer: 'consumer',
	// 5e98d9
	'industrial grade': 'industrial',
	industrial: 'industrial',
	// 4b69ff
	'mil-spec grade': 'mil-spec',
	'mil-spec': 'mil-spec',
	'high grade': 'mil-spec',
	distinguished: 'mil-spec',
	// 8847ff
	restricted: 'restricted',
	remarkable: 'restricted',
	exceptional: 'restricted',
	// d32ce6
	classified: 'classified',
	exotic: 'classified',
	superior: 'classified',
	// eb4b4b
	covert: 'covert',
	extraordinary: 'covert',
	master: 'covert',
	// e4ae39
	contraband: 'contraband'
};

/** The tier for a rarity name, or `null` when we do not recognise it. */
export function rarityTier(name: string | null | undefined): RarityTier | null {
	if (!name) return null;

	return TIER_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/**
 * Background utility for a tier's indicator.
 *
 * Written as complete literal class names so Tailwind's scanner can see them.
 */
const TIER_INDICATOR_CLASS: Record<RarityTier, string> = {
	consumer: 'bg-rarity-consumer',
	industrial: 'bg-rarity-industrial',
	'mil-spec': 'bg-rarity-mil-spec',
	restricted: 'bg-rarity-restricted',
	classified: 'bg-rarity-classified',
	covert: 'bg-rarity-covert',
	contraband: 'bg-rarity-contraband'
};

/**
 * The indicator colour for a rarity.
 *
 * An unrecognised rarity gets a neutral treatment rather than a guessed
 * colour — its name still reads, which is what carries the meaning.
 */
export function rarityIndicatorClass(rarity: SkinRarity | null | undefined): string {
	const tier = rarityTier(rarity?.name);

	return tier ? TIER_INDICATOR_CLASS[tier] : 'bg-muted-foreground';
}
