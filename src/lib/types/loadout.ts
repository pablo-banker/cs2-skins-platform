/**
 * The loadout a visitor is building.
 *
 * **Selection identity is ours, not CS2Cap's.** A selection is a slot, a route
 * slug and a variant described in our own vocabulary — never a catalog item
 * id. An item id identifies one row in someone else's database; saving one
 * would mean a loadout stored today breaks when that database is renumbered,
 * and a shared link would carry an upstream identifier as its public contract.
 * The id is derived server-side, at the moment of pricing, and thrown away.
 */
import type { SkinRarity } from './skin';
import type { SkinSelection } from '$lib/schemas/skin-detail';

/** One filled slot. This is the shape a saved or shared loadout will hold. */
export type LoadoutSelection = {
	slotId: string;
	skinSlug: string;
	/** The exact variant chosen. Empty means the skin's default. */
	variant: SkinSelection;
};

/** A whole loadout: at most one selection per slot. */
export type Loadout = {
	selections: LoadoutSelection[];
};

/** One variant a picker can offer, narrowed to what the UI renders. */
export type LoadoutVariantOption = {
	/**
	 * Present so the picker can key a list and so the resolver can confirm it
	 * matched the same row. It is **not** the selection's identity and never
	 * reaches a saved loadout.
	 */
	itemId: number;
	wear?: string;
	statTrak: boolean;
	souvenir: boolean;
	phase?: string;
};

/** One skin a picker can offer. Deliberately narrower than `Skin`. */
export type LoadoutSkinOption = {
	slug: string;
	weapon: string;
	/** Finish name. Empty for a vanilla knife, which has no finish. */
	name: string;
	fullName: string;
	imageUrl?: string;
	rarity?: SkinRarity;
	variants: LoadoutVariantOption[];
};

/** A page of picker results. */
export type LoadoutSkinPage = {
	slotId: string;
	options: LoadoutSkinOption[];
	total: number;
	page: number;
	pageCount: number;
};

/**
 * What the market could tell us about one selected item.
 *
 * The same three states the kit pages use, for the same reason: "nothing is
 * listed" is a fact about the market and "we could not ask" is a fact about
 * us, and merging them tells the visitor something untrue.
 */
export type LoadoutItemPriceState = 'priced' | 'no-quotes' | 'error';

export type PricedLoadoutItem = {
	slotId: string;
	skinSlug: string;
	state: LoadoutItemPriceState;
	/** Cheapest usable offer, when there is one. Integer minor units. */
	bestPriceMinor?: number;
	currency?: string;
	providerId?: string;
	/** Resolved display name, or the key when the directory was unavailable. */
	providerName?: string;
};

export type LoadoutPricingResult = {
	items: PricedLoadoutItem[];
	/**
	 * Total for the **currently selected** skins. Present only when every one
	 * of them has a usable quote — an empty slot is not a missing price.
	 */
	total?: { priceMinor: number; currency: string };
	/** Steam's total for the same variants, when Steam quotes all of them. */
	steam?: { totalMinor: number; currency: string; savingsMinor: number };
	/** True when every selected item is priced. */
	complete: boolean;
	/**
	 * Echoes the fingerprint of the selections this result was computed for,
	 * so the page can tell whether it still describes what is on screen.
	 */
	fingerprint: string;
};
