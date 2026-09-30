/**
 * The loadout builder's server side: browsing a slot, resolving what was
 * selected, and pricing it.
 *
 * Reads the same cached catalog index Explore browses, so browsing a slot
 * costs **no upstream request at all**. Market traffic happens only when
 * someone asks for prices, and then through the existing multi-item service.
 */
import { getBrowsableSkins, getSkinBySlug } from './catalog';
import { getManySkinPrices, getMarketProviders } from './market';
import { getLoadoutSlot, slotAcceptsSkin, type LoadoutSlotConfig } from '$lib/config/loadout';
import { pickSlotOptions, toSkinOption } from '$lib/features/loadout/picker';
import { loadoutFingerprint } from '$lib/features/loadout/selection';
import { resolveVariant, variantEdition } from '$lib/features/skins/variant-selection';
import { steamComparison } from '$lib/features/prices/steam';
import { isUsableQuote } from '$lib/features/kits/pricing';
import type { LoadoutSelection, LoadoutPricingResult, PricedLoadoutItem } from '$lib/types/loadout';
import type { LoadoutSkinOption, LoadoutSkinPage } from '$lib/types/loadout';
import type { SkinSelection } from '$lib/schemas/skin-detail';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

/** Raised when a client's selections do not describe a loadout we can price. */
export class LoadoutSelectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LoadoutSelectionError';
	}
}

/**
 * One page of the skins a slot accepts.
 *
 * The whole catalog stays on the server: a slot returns twenty options, not
 * four hundred and twenty-eight knives.
 */
export async function searchSlotSkins(
	slotId: string,
	query: { q?: string; page: number },
	options: Cs2CapRequestOptions = {}
): Promise<LoadoutSkinPage | undefined> {
	const slot = getLoadoutSlot(slotId);
	if (!slot) return undefined;

	return pickSlotOptions(await getBrowsableSkins(options), slot, query);
}

export type ResolvedLoadoutItem = {
	selection: LoadoutSelection;
	slot: LoadoutSlotConfig;
	skin: Skin;
	variant: SkinVariant;
};

/** Why one selection could not be restored. Safe to send to a browser. */
export type RejectionReason =
	'unknown-slot' | 'unknown-skin' | 'incompatible' | 'invalid-variant' | 'duplicate-slot';

export type RejectedSelection = {
	/** Absent only when the slot itself was not recognisable. */
	slotId?: string;
	reason: RejectionReason;
};

type SelectionOutcome =
	{ ok: true; item: ResolvedLoadoutItem } | { ok: false; rejected: RejectedSelection };

/**
 * Resolves one selection against the catalog.
 *
 * The single place that decides whether a selection describes a real,
 * slot-compatible, exactly-specified item. Both callers below are built on it,
 * so pricing and restoring can never disagree about what is valid — they
 * differ only in what they do about an invalid one.
 */
async function resolveOne(
	selection: LoadoutSelection,
	taken: Set<string>,
	options: Cs2CapRequestOptions
): Promise<SelectionOutcome> {
	const slot = getLoadoutSlot(selection.slotId);
	if (!slot) return { ok: false, rejected: { reason: 'unknown-slot' } };

	if (taken.has(slot.id)) {
		return { ok: false, rejected: { slotId: slot.id, reason: 'duplicate-slot' } };
	}

	const skin = await getSkinBySlug(selection.skinSlug, options);
	if (!skin) return { ok: false, rejected: { slotId: slot.id, reason: 'unknown-skin' } };

	if (!slotAcceptsSkin(slot, skin)) {
		return { ok: false, rejected: { slotId: slot.id, reason: 'incompatible' } };
	}

	const variant = resolveVariant(skin, selection.variant);
	if (!variant) return { ok: false, rejected: { slotId: slot.id, reason: 'invalid-variant' } };

	// `resolveVariant` falls back by design. A builder selection is an exact
	// choice the visitor made, so an unmet one is rejected rather than quietly
	// becoming a different item — the same promise editorial kits make, and it
	// holds for a loadout restored a year later too.
	const { wear, phase } = selection.variant;
	if ((wear && variant.wear !== wear) || (phase && variant.phase !== phase)) {
		return { ok: false, rejected: { slotId: slot.id, reason: 'invalid-variant' } };
	}

	return { ok: true, item: { selection, slot, skin, variant } };
}

function describe(rejected: RejectedSelection): string {
	const where = rejected.slotId ? ` for slot "${rejected.slotId}"` : '';

	return `${rejected.reason}${where}`;
}

/**
 * Turns what the browser sent into exact catalog variants — **all of it, or
 * none**.
 *
 * What pricing uses. A pricing request is a list of things to go and ask a
 * metered API about, and the client is not the authority on whether an AK-47
 * finish belongs in the gloves slot. Half-answering would hand back a total
 * for a loadout nobody built, so anything wrong throws.
 */
export async function resolveSelections(
	selections: readonly LoadoutSelection[],
	options: Cs2CapRequestOptions = {}
): Promise<ResolvedLoadoutItem[]> {
	const taken = new Set<string>();
	const resolved: ResolvedLoadoutItem[] = [];

	for (const selection of selections) {
		const outcome = await resolveOne(selection, taken, options);

		if (!outcome.ok) throw new LoadoutSelectionError(describe(outcome.rejected));

		taken.add(outcome.item.slot.id);
		resolved.push(outcome.item);
	}

	return resolved;
}

export type ResolvedLoadoutSelection = {
	slotId: string;
	/** Current catalog data, so a restored slot renders like a chosen one. */
	option: LoadoutSkinOption;
	/** The exact variant that resolved — never a substitute. */
	variant: SkinSelection;
};

export type LoadoutResolution = {
	selections: ResolvedLoadoutSelection[];
	rejected: RejectedSelection[];
};

/**
 * Restores as much of a loadout as still exists — **per selection**.
 *
 * What saved and shared loadouts use. A loadout assembled months ago may name
 * a skin a game update retired, and throwing the whole thing away over one
 * entry would punish someone for a change they had no part in. So each
 * selection stands or falls alone, and the ones that fell are reported rather
 * than quietly dropped: a builder that comes back with four of five skins and
 * says nothing is lying by omission.
 */
export async function resolveSelectionsTolerantly(
	selections: readonly LoadoutSelection[],
	options: Cs2CapRequestOptions = {}
): Promise<LoadoutResolution> {
	const taken = new Set<string>();
	const resolved: ResolvedLoadoutSelection[] = [];
	const rejected: RejectedSelection[] = [];

	for (const selection of selections) {
		const outcome = await resolveOne(selection, taken, options);

		if (!outcome.ok) {
			rejected.push(outcome.rejected);
			continue;
		}

		taken.add(outcome.item.slot.id);
		resolved.push({
			slotId: outcome.item.slot.id,
			option: toSkinOption(outcome.item.skin),
			variant: {
				wear: outcome.item.variant.wear,
				edition: variantEdition(outcome.item.variant),
				phase: outcome.item.variant.phase
			}
		});
	}

	return { selections: resolved, rejected };
}

function cheapestUsable(prices: SkinMarketPrices | null): MarketQuote | undefined {
	if (!prices) return undefined;

	return prices.quotes
		.filter(isUsableQuote)
		.sort((a, b) => a.priceMinor - b.priceMinor || a.providerId.localeCompare(b.providerId))[0];
}

/**
 * Current prices for a resolved loadout.
 *
 * One multi-item request through the Phase 10 service, so batch or bounded
 * individual loading is decided by deployment configuration rather than here.
 * No history, no purchase strategies: the builder is an overview, and working
 * out the cheapest way to buy thirty skins across forty marketplaces is a
 * problem the editorial-kit algorithm is explicitly not sized for.
 */
export async function priceLoadout(
	selections: readonly LoadoutSelection[],
	options: Cs2CapRequestOptions = {}
): Promise<LoadoutPricingResult> {
	const resolved = await resolveSelections(selections, options);
	const itemIds = resolved.map((entry) => entry.variant.itemId);

	const [priceResults, providers] = await Promise.all([
		getManySkinPrices(itemIds, options),
		// A missing logo directory must never cost a total; names fall back to
		// the provider key.
		getMarketProviders(options).catch(() => [])
	]);

	const pricesByItemId = new Map(priceResults.map((result) => [result.itemId, result]));
	const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));

	const items: PricedLoadoutItem[] = [];
	// Kept alongside so the Steam comparison runs over the same quote sets,
	// through the shared primitive rather than a second copy of the rule.
	const quoteSets: (SkinMarketPrices | null)[] = [];

	for (const entry of resolved) {
		const result = pricesByItemId.get(entry.variant.itemId);
		const prices = result?.prices ?? null;
		const best = cheapestUsable(prices);

		quoteSets.push(prices);

		items.push({
			slotId: entry.slot.id,
			skinSlug: entry.selection.skinSlug,
			state: !result || result.state === 'error' ? 'error' : best ? 'priced' : 'no-quotes',
			bestPriceMinor: best?.priceMinor,
			currency: best?.currency,
			providerId: best?.providerId,
			providerName: best ? (providerNames.get(best.providerId) ?? best.providerId) : undefined
		});
	}

	const fingerprint = loadoutFingerprint({ selections: [...selections] });
	const complete = items.length > 0 && items.every((item) => item.state === 'priced');

	if (!complete) return { items, complete: false, fingerprint };

	const currencies = new Set(items.map((item) => item.currency));
	const currency = currencies.size === 1 ? [...currencies][0] : undefined;

	// One currency or no total. There is no FX anywhere in this product.
	if (!currency) return { items, complete: false, fingerprint };

	const priceMinor = items.reduce((sum, item) => sum + (item.bestPriceMinor ?? 0), 0);

	return {
		items,
		total: { priceMinor, currency },
		steam: steamComparison(quoteSets, { totalMinor: priceMinor, currency }),
		complete: true,
		fingerprint
	};
}
