/**
 * What Smart Loadout works with and hands back.
 *
 * Application identity throughout: a candidate names a slot, a route slug and
 * a variant in our own vocabulary. The catalog item id exists only long enough
 * to ask what something costs and never reaches the browser — a generated
 * loadout travels to the builder as `LoadoutSelection[]`, exactly like a saved
 * or shared one.
 */
import type { LoadoutSelection } from './loadout';
import type { SkinColor, SkinStyle } from './visual-metadata';
import type { SkinRarity } from './skin';
import type { SkinSelection } from '$lib/schemas/skin-detail';

/** What the visitor asked for. At least one of `color`/`style` is set. */
export type SmartPreferences = {
	budgetMinor: number;
	color?: SkinColor;
	style?: SkinStyle;
	includeKnife: boolean;
	includeGloves: boolean;
};

/**
 * How well one skin answered the request.
 *
 * Reported as a category rather than a number: "matches red" is something a
 * visitor can act on, "visual score 5" is an implementation detail leaking
 * into the product.
 */
export type VisualMatchKind = 'color-and-style' | 'color' | 'style';

/** One priced option the optimizer may choose. Server-side only. */
export type SmartCandidate = {
	entryId: string;
	slotId: string;
	skinSlug: string;
	variant: SkinSelection;
	/** Catalog id, used to price it. Never sent to the browser. */
	itemId: number;
	visualScore: number;
	match: VisualMatchKind;
	priceMinor: number;
	currency: string;
	providerId: string;
	/** Display data, carried so the result needs no second catalog read. */
	weapon: string;
	skinName: string;
	fullName: string;
	imageUrl?: string;
	rarity?: SkinRarity;
	slotLabel: string;
};

/** One line of a generated loadout, as the page renders it. */
export type GeneratedSmartItem = {
	entryId: string;
	slotId: string;
	slotLabel: string;
	skinSlug: string;
	weapon: string;
	skinName: string;
	fullName: string;
	imageUrl?: string;
	rarity?: SkinRarity;
	variant: SkinSelection;
	priceMinor: number;
	currency: string;
	providerId: string;
	providerName?: string;
	match: VisualMatchKind;
};

export type GeneratedSmartLoadout = {
	preferences: SmartPreferences;
	items: GeneratedSmartItem[];
	/** The same loadout in builder identity, for the share-codec handoff. */
	selections: LoadoutSelection[];
	totalMinor: number;
	budgetMinor: number;
	/** `budget - total`. Unused budget, not a saving. */
	remainingMinor: number;
	currency: string;
	/** True when any item matched the colour but not the requested style. */
	partialStyleMatch: boolean;
	steam?: { totalMinor: number; currency: string; savingsMinor: number };
};

/**
 * Why a generation could not produce a loadout.
 *
 * Kept apart because they need different answers: a visual gap is our curation
 * backlog, a pricing gap is the market, and a budget gap is the visitor's to
 * decide about. Collapsing them into "no results" would leave someone
 * adjusting the wrong thing.
 */
export type SmartFailureReason =
	'no-visual-candidates' | 'no-priceable-candidates' | 'budget-too-low' | 'market-unavailable';

export type SmartGenerationResult =
	| { status: 'generated'; loadout: GeneratedSmartLoadout }
	| {
			status: 'failed';
			reason: SmartFailureReason;
			/** For `budget-too-low`: what the current shortlist starts at. */
			minimumMinor?: number;
			currency?: string;
	  };

/** Which preferences can currently produce a complete loadout. */
export type SmartAvailability = {
	colors: SkinColor[];
	styles: SkinStyle[];
	/** Colours with no curated knife or gloves, so extras can warn early. */
	colorsWithoutKnife: SkinColor[];
	colorsWithoutGloves: SkinColor[];
};
