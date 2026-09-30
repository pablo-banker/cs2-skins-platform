/**
 * A skin as the product talks about it: "AK-47 | Redline".
 *
 * Upstream, every exterior/StatTrak/Souvenir combination is its own catalog
 * entry. Our domain groups them back into one product-level skin whose
 * `variants` are the buyable combinations — that is what a skin page, a card
 * and a loadout slot actually deal with.
 */
export type Skin = {
	/** Stable slug derived from weapon + name, e.g. `ak-47-redline`. */
	id: string;
	/** Base item, e.g. `AK-47`. */
	weapon: string;
	/** Finish name, e.g. `Redline`. */
	name: string;
	/** Weapon and finish together, e.g. `AK-47 | Redline`. */
	fullName: string;
	/** Representative artwork for the skin as a whole. */
	imageUrl?: string;
	rarity?: SkinRarity;
	collection?: string;
	/** Weapon classification, e.g. `Assault Rifle`. Absent for the Zeus. */
	weaponType?: string;
	/**
	 * Catalog grouping, e.g. `Rifles`, `Knives`, `Gloves`, `Equipment`.
	 *
	 * The only normalized field that separates knives and gloves from
	 * firearms, which is what the loadout builder's Knife and Gloves slots
	 * match on. `weaponType` cannot do it: gloves are `Wearable` and the Zeus
	 * has no classification at all.
	 */
	itemSubtype?: string;
	variants: SkinVariant[];
};

/**
 * One buyable combination of a skin: an exterior, optionally StatTrak or
 * Souvenir, optionally a phase.
 *
 * `itemId` is the catalog id every price and history request is keyed on, so
 * it must survive normalisation.
 */
export type SkinVariant = {
	itemId: number;
	/** Canonical Steam market hash name for this exact combination. */
	marketHashName: string;
	/** Exterior, e.g. `Field-Tested`. Absent for items without wear. */
	wear?: string;
	statTrak: boolean;
	souvenir: boolean;
	/** Phase label for phased finishes, e.g. `Phase 2`, `Ruby`. */
	phase?: string;
	minFloat?: number;
	maxFloat?: number;
	imageUrl?: string;
};

export type SkinRarity = {
	/** Rarity tier name, e.g. `Covert`. */
	name: string;
	/** Hex colour (`#EB4B4B`) when upstream gives one, otherwise absent. */
	color?: string;
};

/**
 * Catalog-wide filter vocabulary, used to build discovery filters without
 * hardcoding CS2's taxonomy into the app.
 */
export type CatalogFilters = {
	totalItems: number;
	itemTypes: string[];
	itemSubtypes: string[];
	weaponTypes: string[];
	wears: string[];
	phases: string[];
	collections: string[];
	rarities: string[];
	styles: string[];
};
