/**
 * What the Knife + Gloves matcher works with and hands to the page.
 *
 * Application identity throughout: a slug, a variant in our own vocabulary, and
 * money as integer minor units plus a currency. No catalog item id reaches the
 * browser — the matcher derives one to ask what something costs and discards it,
 * exactly as Smart Loadout does.
 */
import type { SkinSelection } from '$lib/schemas/skin-detail';
import type { SkinRarity } from './skin';
import type { LoadoutSelection } from './loadout';
import type { EquipmentSlotId } from '$lib/features/recommendations/knife-gloves';

/** One option in the source picker. Deliberately tiny: ~56 of these ship. */
export type KnifeGloveSourceOption = {
	slug: string;
	slotId: EquipmentSlotId;
	weapon: string;
	/** Finish name. Empty for a vanilla knife, where the weapon is the identity. */
	name: string;
	imageUrl?: string;
};

/** A current lowest ask, ready to render. Never an average or a last sale. */
export type KnifeGlovePrice = {
	amountMinor: number;
	currency: string;
	providerId: string;
	/** Absent when the provider directory could not be loaded. */
	providerName?: string;
};

/** Shared shape of the source panel and a match card. */
type PairSide = {
	slug: string;
	slotId: EquipmentSlotId;
	weapon: string;
	name: string;
	fullName: string;
	imageUrl?: string;
	rarity?: SkinRarity;
	/** The exact variant being shown, priced and linked. */
	variant: SkinSelection;
	/** `null` when no usable quote exists — which is not the same as zero. */
	price: KnifeGlovePrice | null;
};

export type KnifeGloveSource = PairSide & {
	/**
	 * Normal-edition exteriors this skin is sold in, in condition order.
	 *
	 * Drives the source exterior selector. Empty for a vanilla knife, which has
	 * no exterior at all — an absent control rather than a control with one
	 * option.
	 */
	wears: string[];
};

export type KnifeGloveMatch = PairSide & {
	/**
	 * Source + match, when **both** sides have a usable quote in one currency.
	 *
	 * Absent otherwise. Half a total presented as a total is worse than no
	 * total, because it looks complete.
	 */
	pairTotal: { amountMinor: number; currency: string } | null;
	/** The pair as builder identity, for the existing share codec. */
	pairSelections: LoadoutSelection[];
};

/**
 * Why the matcher cannot show matches, or the matches themselves.
 *
 * Every failure here is **recoverable selection state**, never a route error:
 * the picker stays usable and the page keeps working. A mistyped `?skin=` is a
 * bad choice, not a missing page.
 */
export type KnifeGlovesResult =
	| { state: 'none' }
	| { state: 'unknown-skin' }
	| { state: 'wrong-category' }
	| { state: 'uncurated'; fullName: string }
	| {
			state: 'ready';
			source: KnifeGloveSource;
			matches: KnifeGloveMatch[];
			/** True when the market answered for nothing at all. */
			pricesUnavailable: boolean;
	  };
