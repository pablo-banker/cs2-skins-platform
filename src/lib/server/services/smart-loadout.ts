/**
 * Generating a loadout.
 *
 * ```text
 * preferences → curated candidates → visual ranking → bounded shortlist
 *            → exact variants → one multi-item price request
 *            → Pareto budget optimizer → generated loadout
 * ```
 *
 * The shape of that pipeline is the point. Everything visual happens **before**
 * anything is priced, so a generation costs a few dozen price lookups rather
 * than one per curated skin — and the shortlist is bounded by a constant the
 * server owns, not by anything a caller can ask for.
 */
import { getCuratedCandidates } from './smart-candidates';
import { getManySkinPrices, getMarketProviders } from './market';
import { visualMatchScore } from './discovery';
import { SMART_CORE, smartCoreSlots, type SmartCoreEntry } from '$lib/config/smart-loadout';
import { pickPracticalVariant } from '$lib/features/skins/practical-variant';
import { optimizeLoadout, type CandidatePool } from '$lib/features/smart-loadout/optimizer';
import { variantEdition } from '$lib/features/skins/variant-selection';
import { isUsableQuote } from '$lib/features/kits/pricing';
import { steamComparison } from '$lib/features/prices/steam';
import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';
import type {
	GeneratedSmartItem,
	SmartAvailability,
	SmartCandidate,
	SmartGenerationResult,
	SmartPreferences,
	VisualMatchKind
} from '$lib/types/smart-loadout';
import type { DiscoverableSkin, SkinColor, SkinStyle } from '$lib/types/visual-metadata';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';

/**
 * How many candidates per entry reach the market.
 *
 * The whole performance and quota design in one number. Eight active entries
 * at six candidates is at most 48 price lookups for a cold generation — well
 * inside one batch request, and a fraction of pricing all 161 curated skins.
 *
 * The cost is honesty about scope: the result is optimal **within the
 * shortlist that was priced**, not across everything curated. Raising this
 * raises quota use linearly for a shrinking improvement, because the shortlist
 * is already the top of the visual ranking.
 */
export const SMART_CANDIDATES_PER_ENTRY = 6;

/** Hard ceiling on priced candidates, so a regression cannot price the lot. */
export const SMART_MAX_PRICED_CANDIDATES = SMART_CANDIDATES_PER_ENTRY * SMART_CORE.length;

/** The core entries a request actually activates. */
function activeEntries(preferences: {
	includeKnife: boolean;
	includeGloves: boolean;
}): SmartCoreEntry[] {
	return SMART_CORE.filter((entry) => {
		if (entry.id === 'knife') return preferences.includeKnife;
		if (entry.id === 'gloves') return preferences.includeGloves;

		return true;
	});
}

/**
 * How a skin answered the request.
 *
 * Derived from the profile rather than from the score, because the score is a
 * number and this is a sentence someone reads.
 */
function matchKind(
	skin: DiscoverableSkin,
	color: SkinColor | undefined,
	style: SkinStyle | undefined
): VisualMatchKind {
	const hasStyle = Boolean(style && skin.visual?.styles.includes(style));

	if (!color) return 'style';

	return hasStyle ? 'color-and-style' : 'color';
}

/**
 * The eligible skins for one entry, best match first.
 *
 * **Colour is never relaxed.** When both a colour and a style are asked for,
 * skins matching both come first; if an entry has none, it falls back to
 * skins matching the colour alone — never to a different colour. Colour is the
 * stronger visual promise, and a "red loadout" containing a blue rifle is not
 * a partial match, it is a wrong answer.
 *
 * With only a style asked for, every candidate must carry that style. There is
 * nothing weaker to fall back to, so an entry with no styled candidate simply
 * has none.
 */
async function shortlistFor(
	entry: SmartCoreEntry,
	color: SkinColor | undefined,
	style: SkinStyle | undefined,
	options: Cs2CapRequestOptions
): Promise<{ skin: DiscoverableSkin; slotId: string; slotLabel: string }[]> {
	const found: { skin: DiscoverableSkin; slotId: string; slotLabel: string }[] = [];
	const seen = new Set<string>();

	// Both passes run across every alternative slot before the fallback, so a
	// USP-S that matches colour+style beats a P2000 that only matches colour.
	const passes: { colors?: SkinColor[]; styles?: SkinStyle[] }[] = color
		? style
			? [{ colors: [color], styles: [style] }, { colors: [color] }]
			: [{ colors: [color] }]
		: [{ styles: style ? [style] : [] }];

	for (const criteria of passes) {
		for (const slot of smartCoreSlots(entry)) {
			const candidates = await getCuratedCandidates(
				{
					slotId: slot.id,
					...criteria,
					// Style is a bonus on top of colour, never a requirement that
					// could exclude a colour match; the pass structure above is
					// what makes the exact-match preference.
					colorMode: 'all',
					styleMode: 'all'
				},
				options
			);

			for (const skin of candidates) {
				if (seen.has(skin.id)) continue;

				seen.add(skin.id);
				found.push({ skin, slotId: slot.id, slotLabel: slot.label });
			}
		}

		// An exact colour+style pass that filled the shortlist means no fallback
		// is needed; one that found nothing falls through to colour alone.
		if (found.length >= SMART_CANDIDATES_PER_ENTRY) break;
	}

	return found.slice(0, SMART_CANDIDATES_PER_ENTRY);
}

/** Which colours and styles can currently fill every required entry. */
export async function getSmartAvailability(
	options: Cs2CapRequestOptions = {}
): Promise<SmartAvailability> {
	const required = activeEntries({ includeKnife: false, includeGloves: false });
	const knife = SMART_CORE.find((entry) => entry.id === 'knife');
	const gloves = SMART_CORE.find((entry) => entry.id === 'gloves');

	async function covers(
		entries: SmartCoreEntry[],
		criteria: { color?: SkinColor; style?: SkinStyle }
	): Promise<boolean> {
		for (const entry of entries) {
			const found = await shortlistFor(entry, criteria.color, criteria.style, options);
			if (found.length === 0) return false;
		}

		return true;
	}

	const colors: SkinColor[] = [];
	const colorsWithoutKnife: SkinColor[] = [];
	const colorsWithoutGloves: SkinColor[] = [];

	for (const color of SKIN_COLORS) {
		if (!(await covers(required, { color }))) continue;

		colors.push(color);

		// Reported separately so the extras can warn before a generation is
		// spent discovering there are no purple gloves.
		if (knife && !(await covers([knife], { color }))) colorsWithoutKnife.push(color);
		if (gloves && !(await covers([gloves], { color }))) colorsWithoutGloves.push(color);
	}

	const styles: SkinStyle[] = [];

	// Style viability is judged on its own, not per colour pair: style tags are
	// deliberately sparse, and a combination that turns out impossible is
	// caught at generation with an explanation.
	for (const style of SKIN_STYLES) {
		if (await covers(required, { style })) styles.push(style);
	}

	return { colors, styles, colorsWithoutKnife, colorsWithoutGloves };
}

function cheapestUsable(prices: SkinMarketPrices | null): MarketQuote | undefined {
	if (!prices) return undefined;

	return prices.quotes
		.filter(isUsableQuote)
		.sort((a, b) => a.priceMinor - b.priceMinor || a.providerId.localeCompare(b.providerId))[0];
}

/** Generates a loadout, or explains why it could not. */
export async function generateSmartLoadout(
	preferences: SmartPreferences,
	options: Cs2CapRequestOptions = {}
): Promise<SmartGenerationResult> {
	const entries = activeEntries(preferences);

	// ---- Visual: bounded shortlists, before anything is priced ------------
	const shortlists = new Map<string, Awaited<ReturnType<typeof shortlistFor>>>();

	for (const entry of entries) {
		const found = await shortlistFor(entry, preferences.color, preferences.style, options);

		if (found.length === 0) return { status: 'failed', reason: 'no-visual-candidates' };

		shortlists.set(entry.id, found);
	}

	// ---- Exact variants: one per skin, so pricing stays bounded -----------
	type Pending = {
		entry: SmartCoreEntry;
		slotId: string;
		slotLabel: string;
		skin: DiscoverableSkin;
		itemId: number;
		variant: SmartCandidate['variant'];
	};

	const pending: Pending[] = [];

	for (const entry of entries) {
		for (const { skin, slotId, slotLabel } of shortlists.get(entry.id) ?? []) {
			const variant = pickPracticalVariant(skin);

			// No normal-edition variant means no Smart variant: StatTrak and
			// Souvenir are choices someone makes on purpose.
			if (!variant) continue;

			pending.push({
				entry,
				slotId,
				slotLabel,
				skin,
				itemId: variant.itemId,
				variant: {
					wear: variant.wear,
					edition: variantEdition(variant),
					phase: variant.phase
				}
			});
		}
	}

	if (pending.length === 0) return { status: 'failed', reason: 'no-visual-candidates' };

	// The guard that makes the design hold. A regression that widened the
	// shortlist would be caught here rather than on the quota bill.
	const itemIds = [...new Set(pending.map((candidate) => candidate.itemId))];

	if (itemIds.length > SMART_MAX_PRICED_CANDIDATES) {
		throw new Error(
			`Smart Loadout tried to price ${itemIds.length} candidates; the cap is ${SMART_MAX_PRICED_CANDIDATES}.`
		);
	}

	// ---- Market: one multi-item request for the whole shortlist -----------
	let priceResults;
	let providers;

	try {
		[priceResults, providers] = await Promise.all([
			getManySkinPrices(itemIds, options),
			getMarketProviders(options).catch(() => [])
		]);
	} catch {
		return { status: 'failed', reason: 'market-unavailable' };
	}

	const pricesByItemId = new Map(priceResults.map((result) => [result.itemId, result.prices]));
	const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));

	// ---- Candidates: only what can actually be bought ---------------------
	const pools: CandidatePool[] = [];

	for (const entry of entries) {
		const candidates: SmartCandidate[] = [];

		for (const item of pending.filter((candidate) => candidate.entry.id === entry.id)) {
			const quote = cheapestUsable(pricesByItemId.get(item.itemId) ?? null);

			// A candidate with no current price cannot take part: it has no cost
			// to weigh, and assuming one would invent a number.
			if (!quote) continue;

			candidates.push({
				entryId: entry.id,
				slotId: item.slotId,
				skinSlug: item.skin.id,
				variant: item.variant,
				itemId: item.itemId,
				visualScore: visualMatchScore(item.skin.visual, {
					colors: preferences.color ? [preferences.color] : [],
					styles: preferences.style ? [preferences.style] : []
				}),
				match: matchKind(item.skin, preferences.color, preferences.style),
				priceMinor: quote.priceMinor,
				currency: quote.currency,
				providerId: quote.providerId,
				weapon: item.skin.weapon,
				skinName: item.skin.name,
				fullName: item.skin.fullName,
				imageUrl: item.skin.imageUrl,
				rarity: item.skin.rarity,
				slotLabel: item.slotLabel
			});
		}

		if (candidates.length === 0) {
			// Every entry must be fillable. Losing one to a market outage is a
			// different problem from losing one to our curation backlog.
			const everyEntryLostPrices = entries.every((other) =>
				pending
					.filter((candidate) => candidate.entry.id === other.id)
					.every((candidate) => !cheapestUsable(pricesByItemId.get(candidate.itemId) ?? null))
			);

			return {
				status: 'failed',
				reason: everyEntryLostPrices ? 'market-unavailable' : 'no-priceable-candidates'
			};
		}

		pools.push({ entryId: entry.id, candidates });
	}

	// ---- Budget ------------------------------------------------------------
	const optimized = optimizeLoadout(pools, preferences.budgetMinor);

	if (!optimized.ok) {
		if (optimized.reason === 'budget-too-low') {
			return {
				status: 'failed',
				reason: 'budget-too-low',
				minimumMinor: optimized.minimumMinor,
				currency: pools[0].candidates[0].currency
			};
		}

		if (optimized.reason === 'currency-mismatch') {
			return { status: 'failed', reason: 'market-unavailable' };
		}

		return { status: 'failed', reason: 'no-priceable-candidates' };
	}

	const items: GeneratedSmartItem[] = optimized.picks.map((pick) => ({
		entryId: pick.entryId,
		slotId: pick.slotId,
		slotLabel: pick.slotLabel,
		skinSlug: pick.skinSlug,
		weapon: pick.weapon,
		skinName: pick.skinName,
		fullName: pick.fullName,
		imageUrl: pick.imageUrl,
		rarity: pick.rarity,
		variant: pick.variant,
		priceMinor: pick.priceMinor,
		currency: pick.currency,
		providerId: pick.providerId,
		providerName: providerNames.get(pick.providerId),
		match: pick.match
	}));

	// Free: the quote sets are already loaded, so the Steam total costs no
	// further request. Absent when Steam does not cover every chosen item.
	const steam = steamComparison(
		optimized.picks.map((pick) => pricesByItemId.get(pick.itemId) ?? null),
		{ totalMinor: optimized.totalMinor, currency: optimized.currency }
	);

	return {
		status: 'generated',
		loadout: {
			preferences,
			items,
			selections: optimized.picks.map((pick) => ({
				slotId: pick.slotId,
				skinSlug: pick.skinSlug,
				variant: pick.variant
			})),
			totalMinor: optimized.totalMinor,
			budgetMinor: preferences.budgetMinor,
			remainingMinor: preferences.budgetMinor - optimized.totalMinor,
			currency: optimized.currency,
			partialStyleMatch: Boolean(preferences.style) && items.some((item) => item.match === 'color'),
			steam
		}
	};
}
