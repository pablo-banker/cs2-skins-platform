/**
 * The filter vocabularies Explore's controls render.
 *
 * Built on the server from catalog metadata and the skin index, so no
 * presentation component ever sees an upstream metadata shape.
 */
export type ExploreFilterOptions = {
	weapons: string[];
	weaponTypes: string[];
	wears: string[];
	rarities: string[];
	collections: string[];
};
