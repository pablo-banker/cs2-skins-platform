/**
 * The Knife + Gloves matcher.
 *
 * ```text
 * source slug + optional exact variant
 *        ↓  curated visual metadata, no I/O
 *   opposite category, ranked by similarity
 *        ↓  one practical variant each
 *   ONE multi-item price request (≤ 7 item ids)
 *        ↓
 *   source panel + pair cards
 * ```
 *
 * **Visual first, then price.** The ranking is settled before the market is
 * asked anything and is never revisited afterwards — a cheaper pair is not a
 * better-looking pair, and reordering on price would turn a pairing tool into a
 * cheapest-pair search without anyone deciding to.
 *
 * Seven item ids is the whole cost: the source plus six counterparts. That is an
 * order of magnitude below Smart Loadout, which is why there is no cache here.
 */
import { getBrowsableSkins, getSkinBySlug } from './catalog';
import { enrichSkin, enrichSkins } from './discovery';
import { getManySkinPrices, getMarketProviders } from './market';
import {
	equipmentSlot,
	knifeGloveMatches,
	oppositeEquipmentSlot,
	KNIFE_SLOT_ID
} from '$lib/features/recommendations/knife-gloves';
import { pickPracticalVariant } from '$lib/features/skins/practical-variant';
import {
	orderedVariants,
	resolveVariant,
	variantEdition
} from '$lib/features/skins/variant-selection';
import { isUsableQuote } from '$lib/features/kits/pricing';
import type { SkinSelection } from '$lib/schemas/skin-detail';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Skin, SkinVariant } from '$lib/types/skin';
import type {
	KnifeGloveMatch,
	KnifeGlovePrice,
	KnifeGloveSource,
	KnifeGloveSourceOption,
	KnifeGlovesResult
} from '$lib/types/knife-gloves';
import type { DiscoverableSkin } from '$lib/types/visual-metadata';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

/** Every curated knife and pair of gloves, as picker options. */
export async function getKnifeGloveSourceOptions(
	options: Cs2CapRequestOptions = {}
): Promise<KnifeGloveSourceOption[]> {
	const curated = await curatedEquipment(options);

	return (
		curated
			.map((skin) => ({
				slug: skin.id,
				slotId: equipmentSlot(skin)!,
				weapon: skin.weapon,
				name: skin.name,
				imageUrl: representativeImage(skin)
			}))
			// Knives first, then gloves; alphabetical within each. Stable ordering
			// matters more than cleverness for a list someone scans.
			.sort(
				(a, b) =>
					Number(a.slotId !== KNIFE_SLOT_ID) - Number(b.slotId !== KNIFE_SLOT_ID) ||
					a.weapon.localeCompare(b.weapon) ||
					a.name.localeCompare(b.name)
			)
	);
}

/**
 * Curated knives and gloves from the cached catalog.
 *
 * The only scan in this file. Roughly 8% of the catalog is curated and a
 * fraction of that is equipment, so this narrows ~2,000 skins to ~56.
 */
async function curatedEquipment(options: Cs2CapRequestOptions): Promise<DiscoverableSkin[]> {
	return enrichSkins(await getBrowsableSkins(options)).filter(
		(skin) => skin.visual !== null && equipmentSlot(skin) !== undefined
	);
}

/** A variant's artwork, falling back to the product's. */
function representativeImage(skin: Skin): string | undefined {
	return pickPracticalVariant(skin)?.imageUrl ?? skin.imageUrl;
}

/** The selection vocabulary for a catalog variant. */
function selectionOf(variant: SkinVariant): SkinSelection {
	return {
		wear: variant.wear,
		edition: variantEdition(variant),
		phase: variant.phase
	};
}

/** Cheapest quote that may be shown, or nothing. Stale and zero are excluded. */
function cheapestUsable(prices: SkinMarketPrices | null | undefined): MarketQuote | undefined {
	if (!prices) return undefined;

	return prices.quotes
		.filter(isUsableQuote)
		.sort((a, b) => a.priceMinor - b.priceMinor || a.providerId.localeCompare(b.providerId))[0];
}

function toPrice(
	quote: MarketQuote | undefined,
	providerNames: Map<string, string>
): KnifeGlovePrice | null {
	if (!quote) return null;

	return {
		amountMinor: quote.priceMinor,
		currency: quote.currency,
		providerId: quote.providerId,
		providerName: providerNames.get(quote.providerId)
	};
}

/**
 * Finds a pairing for one source skin, or explains why it cannot.
 *
 * Every failure is recoverable selection state — an unknown slug, a rifle, an
 * uncurated knife. None of them is a route error: the page keeps its picker and
 * the visitor picks again.
 */
export async function getKnifeGlovesResult(
	slug: string | undefined,
	selection: SkinSelection,
	options: Cs2CapRequestOptions = {}
): Promise<KnifeGlovesResult> {
	if (!slug) return { state: 'none' };

	const found = await getSkinBySlug(slug, options);
	if (!found) return { state: 'unknown-skin' };

	const sourceSlot = equipmentSlot(found);
	// A rifle is a perfectly good skin and a nonsense source for this page.
	if (!sourceSlot) return { state: 'wrong-category' };

	const source = enrichSkin(found);
	if (!source.visual) return { state: 'uncurated', fullName: source.fullName };

	/**
	 * The exact variant to price.
	 *
	 * An explicit selection is honoured exactly — someone who arrived from a
	 * Factory New knife must not be quietly shown Field-Tested. The practical
	 * default applies only when the URL named nothing.
	 */
	const hasExplicitVariant = Boolean(selection.wear || selection.edition || selection.phase);
	const sourceVariant = hasExplicitVariant
		? resolveVariant(source, selection)
		: pickPracticalVariant(source);

	if (!sourceVariant) return { state: 'uncurated', fullName: source.fullName };

	// ---- Visual: ranked and cut before anything is priced --------------------
	const candidates = await curatedEquipment(options);
	const ranked = knifeGloveMatches(source, candidates);

	const priceable = ranked
		.map((entry) => {
			const variant = pickPracticalVariant(entry.skin);

			return variant ? { entry, variant } : undefined;
		})
		.filter((row): row is { entry: (typeof ranked)[number]; variant: SkinVariant } => Boolean(row));

	// ---- Market: one request for the source and every counterpart ------------
	const itemIds = [
		...new Set([sourceVariant.itemId, ...priceable.map((row) => row.variant.itemId)])
	];

	// Prices are context here, not the feature. Each side fails on its own and
	// losing either costs the totals and nothing else — the pairing is already
	// decided.
	const [priceResults, providers] = await Promise.all([
		getManySkinPrices(itemIds, options).catch(
			(): Awaited<ReturnType<typeof getManySkinPrices>> => []
		),
		getMarketProviders(options).catch((): Awaited<ReturnType<typeof getMarketProviders>> => [])
	]);

	const pricesByItemId = new Map(priceResults.map((result) => [result.itemId, result.prices]));
	const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));

	const sourcePrice = toPrice(
		cheapestUsable(pricesByItemId.get(sourceVariant.itemId)),
		providerNames
	);
	const sourceSelection = selectionOf(sourceVariant);

	const sourcePanel: KnifeGloveSource = {
		slug: source.id,
		slotId: sourceSlot,
		weapon: source.weapon,
		name: source.name,
		fullName: source.fullName,
		imageUrl: sourceVariant.imageUrl ?? source.imageUrl,
		rarity: source.rarity,
		variant: sourceSelection,
		price: sourcePrice,
		// Normal edition only: the matcher has no StatTrak UI, and offering an
		// exterior that flips the edition would be a surprise.
		wears: orderedVariants(source)
			.filter((variant) => variantEdition(variant) === 'normal' && variant.wear)
			.map((variant) => variant.wear as string)
			.filter((wear, index, all) => all.indexOf(wear) === index)
	};

	const matches: KnifeGloveMatch[] = priceable.map(({ entry, variant }) => {
		const price = toPrice(cheapestUsable(pricesByItemId.get(variant.itemId)), providerNames);
		const matchSelection = selectionOf(variant);

		return {
			slug: entry.slug,
			slotId: oppositeEquipmentSlot(sourceSlot),
			weapon: entry.skin.weapon,
			name: entry.skin.name,
			fullName: entry.skin.fullName,
			imageUrl: variant.imageUrl ?? entry.skin.imageUrl,
			rarity: entry.skin.rarity,
			variant: matchSelection,
			price,
			// Both sides, one currency, or no total. There is no FX here and a
			// half-total that looks whole is worse than none.
			pairTotal:
				sourcePrice && price && sourcePrice.currency === price.currency
					? {
							amountMinor: sourcePrice.amountMinor + price.amountMinor,
							currency: price.currency
						}
					: null,
			// The pair in builder identity, for the existing share codec. Slot
			// order follows the registry so the link is canonical either way.
			pairSelections: [
				{ slotId: sourceSlot, skinSlug: source.id, variant: sourceSelection },
				{ slotId: entry.slotId, skinSlug: entry.slug, variant: matchSelection }
			]
		};
	});

	return {
		state: 'ready',
		source: sourcePanel,
		matches,
		// Nothing anywhere has a price, which is a market outage worth saying
		// once. One item missing a quote is an item-level state, not this.
		pricesUnavailable: !sourcePrice && matches.every((match) => match.price === null)
	};
}
