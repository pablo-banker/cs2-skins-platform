/**
 * How much of the catalog has actually been looked at.
 *
 * Pure, and honest by construction: it counts curated records against the real
 * catalog rather than against a curated subset, so the number it reports is
 * the number that matters. Coverage is a few per cent and saying so plainly is
 * the point — a product decision rests on it.
 */
import { visualMetadataKey } from '$lib/server/services/visual-metadata';
import { SMART_CORE, smartCoreSlots, type SmartCoreEntry } from '$lib/config/smart-loadout';
import { slotAcceptsSkin } from '$lib/config/loadout';
import type { SkinVisualMetadata } from '$lib/types/visual-metadata';
import type { Skin } from '$lib/types/skin';

export type CoverageBreakdown = {
	/** Count per label, highest first, then alphabetical. */
	entries: { label: string; count: number }[];
	total: number;
};

export type VisualCoverage = {
	catalogSkins: number;
	curatedSkins: number;
	/** 0–100, rounded to one decimal. Deliberately not dressed up. */
	percentage: number;
	byWeapon: CoverageBreakdown;
	byColor: CoverageBreakdown;
	byStyle: CoverageBreakdown;
};

function breakdown(values: readonly string[]): CoverageBreakdown {
	const counts = new Map<string, number>();

	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

	return {
		entries: [...counts.entries()]
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
		total: values.length
	};
}

/**
 * Coverage of the catalog by the curated dataset.
 *
 * A record whose skin is no longer in the catalog is **not** counted as
 * coverage: it covers nothing. It is not an error either — a game update can
 * retire a skin — so it is simply left out of the totals rather than inflating
 * them.
 */
export function visualMetadataCoverage(
	catalog: readonly Skin[],
	records: readonly SkinVisualMetadata[]
): VisualCoverage {
	const curated = new Map(records.map((record) => [record.key, record]));

	const covered = catalog.filter((skin) => curated.has(visualMetadataKey(skin.weapon, skin.name)));

	const matched = covered.map(
		(skin) => curated.get(visualMetadataKey(skin.weapon, skin.name)) as SkinVisualMetadata
	);

	return {
		catalogSkins: catalog.length,
		curatedSkins: covered.length,
		percentage:
			catalog.length === 0 ? 0 : Math.round((covered.length / catalog.length) * 1000) / 10,
		byWeapon: breakdown(covered.map((skin) => skin.weapon)),
		// A skin with two primary colours counts once for each: the question
		// this answers is "are there blue candidates", not "how many skins".
		byColor: breakdown(matched.flatMap((record) => record.primaryColors)),
		byStyle: breakdown(matched.flatMap((record) => record.styles))
	};
}

export type SmartCoreCoverageEntry = {
	entry: SmartCoreEntry;
	/** Curated candidates available, per builder slot behind this entry. */
	bySlot: { slotId: string; label: string; curated: number; catalog: number }[];
	curated: number;
};

/**
 * Whether the Smart Core has enough curated candidates to generate from.
 *
 * The number Phase 14 actually depends on. Overall catalog coverage can be low
 * without mattering; a core slot with two curated skins would make every
 * generated loadout look the same, and that would matter a great deal.
 */
export function smartCoreCoverage(
	catalog: readonly Skin[],
	records: readonly SkinVisualMetadata[]
): SmartCoreCoverageEntry[] {
	const curated = new Set(records.map((record) => record.key));

	return SMART_CORE.map((entry) => {
		const bySlot = smartCoreSlots(entry).map((slot) => {
			const compatible = catalog.filter((skin) => slotAcceptsSkin(slot, skin));

			return {
				slotId: slot.id,
				label: slot.label,
				catalog: compatible.length,
				curated: compatible.filter((skin) => curated.has(visualMetadataKey(skin.weapon, skin.name)))
					.length
			};
		});

		return {
			entry,
			bySlot,
			curated: bySlot.reduce((sum, slot) => sum + slot.curated, 0)
		};
	});
}
