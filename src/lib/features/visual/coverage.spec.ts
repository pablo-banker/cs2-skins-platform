import { describe, expect, it } from 'vitest';
import { smartCoreCoverage, visualMetadataCoverage } from './coverage';
import { SMART_CORE } from '$lib/config/smart-loadout';
import type { SkinVisualMetadata } from '$lib/types/visual-metadata';
import type { Skin } from '$lib/types/skin';

function skin(weapon: string, name: string, itemSubtype = 'Rifles'): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		itemSubtype,
		variants: []
	};
}

function record(
	weapon: string,
	name: string,
	primaryColors: string[] = ['red'],
	styles: string[] = []
): SkinVisualMetadata {
	return {
		key: `${weapon.toLowerCase()}::${name.toLowerCase()}`,
		weapon,
		skinName: name,
		primaryColors: primaryColors as SkinVisualMetadata['primaryColors'],
		secondaryColors: [],
		styles: styles as SkinVisualMetadata['styles']
	};
}

const CATALOG: Skin[] = [
	skin('AK-47', 'Redline'),
	skin('AK-47', 'Slate'),
	skin('AK-47', 'Vulcan'),
	skin('AWP', 'Asiimov'),
	skin('Karambit', 'Night', 'Knives'),
	skin('Sport Gloves', 'Vice', 'Gloves')
];

describe('visualMetadataCoverage', () => {
	it('counts curated skins against the whole catalog', () => {
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AK-47', 'Redline'),
			record('AWP', 'Asiimov')
		]);

		expect(coverage.catalogSkins).toBe(6);
		expect(coverage.curatedSkins).toBe(2);
	});

	it('reports the percentage honestly, to one decimal', () => {
		const coverage = visualMetadataCoverage(CATALOG, [record('AK-47', 'Redline')]);

		// 1 of 6 — not rounded up into something flattering.
		expect(coverage.percentage).toBe(16.7);
	});

	it('reports zero for an empty dataset', () => {
		const coverage = visualMetadataCoverage(CATALOG, []);

		expect(coverage.curatedSkins).toBe(0);
		expect(coverage.percentage).toBe(0);
		expect(coverage.byColor.entries).toEqual([]);
	});

	it('survives an empty catalog without dividing by zero', () => {
		expect(visualMetadataCoverage([], []).percentage).toBe(0);
	});

	it('does not count a record whose skin left the catalog', () => {
		// A retired skin is not an error, but it covers nothing.
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AK-47', 'Redline'),
			record('AK-47', 'A Skin That Was Removed')
		]);

		expect(coverage.curatedSkins).toBe(1);
		expect(coverage.percentage).toBe(16.7);
	});

	it('breaks coverage down by weapon, highest first', () => {
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AK-47', 'Redline'),
			record('AK-47', 'Slate'),
			record('AWP', 'Asiimov')
		]);

		expect(coverage.byWeapon.entries).toEqual([
			{ label: 'AK-47', count: 2 },
			{ label: 'AWP', count: 1 }
		]);
		expect(coverage.byWeapon.total).toBe(3);
	});

	it('counts a skin once per primary colour, because the question is candidate supply', () => {
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AK-47', 'Redline', ['red', 'black']),
			record('AWP', 'Asiimov', ['white', 'orange'])
		]);

		expect(coverage.byColor.entries.map((entry) => entry.label).sort()).toEqual([
			'black',
			'orange',
			'red',
			'white'
		]);
		expect(coverage.byColor.total).toBe(4);
	});

	it('breaks down by style, ignoring records that carry none', () => {
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AK-47', 'Redline', ['red'], ['dark']),
			record('AK-47', 'Slate', ['gray'], ['dark', 'minimal']),
			record('AWP', 'Asiimov', ['white'])
		]);

		expect(coverage.byStyle.entries).toEqual([
			{ label: 'dark', count: 2 },
			{ label: 'minimal', count: 1 }
		]);
	});

	it('orders ties alphabetically, so a report never shuffles', () => {
		const coverage = visualMetadataCoverage(CATALOG, [
			record('AWP', 'Asiimov', ['white']),
			record('AK-47', 'Redline', ['red'])
		]);

		expect(coverage.byColor.entries.map((entry) => entry.label)).toEqual(['red', 'white']);
	});

	it('does not mutate the catalog or the records', () => {
		const catalog = structuredClone(CATALOG);
		const records = [record('AK-47', 'Redline')];
		const before = { catalog: structuredClone(catalog), records: structuredClone(records) };

		visualMetadataCoverage(catalog, records);

		expect(catalog).toEqual(before.catalog);
		expect(records).toEqual(before.records);
	});
});

describe('smartCoreCoverage', () => {
	it('reports every core entry, in core order', () => {
		const coverage = smartCoreCoverage(CATALOG, []);

		expect(coverage.map((entry) => entry.entry.id)).toEqual(SMART_CORE.map((entry) => entry.id));
	});

	it('counts curated candidates per slot', () => {
		const coverage = smartCoreCoverage(CATALOG, [
			record('AK-47', 'Redline'),
			record('AK-47', 'Slate')
		]);

		const ak = coverage.find((entry) => entry.entry.id === 't-rifle');

		expect(ak?.curated).toBe(2);
		expect(ak?.bySlot).toEqual([{ slotId: 'ak-47', label: 'AK-47', catalog: 3, curated: 2 }]);
	});

	it('sums across the alternatives inside one entry', () => {
		// A CT rifle can be either; what matters is that the entry has
		// candidates at all.
		const catalog = [...CATALOG, skin('M4A1-S', 'Printstream'), skin('M4A4', 'Magnesium')];

		const coverage = smartCoreCoverage(catalog, [
			record('M4A1-S', 'Printstream'),
			record('M4A4', 'Magnesium')
		]);

		const rifle = coverage.find((entry) => entry.entry.id === 'ct-rifle');

		expect(rifle?.curated).toBe(2);
		expect(rifle?.bySlot.map((slot) => slot.slotId)).toEqual(['m4a1-s', 'm4a4']);
	});

	it('counts knives and gloves through their subtype slots', () => {
		const coverage = smartCoreCoverage(CATALOG, [
			record('Karambit', 'Night'),
			record('Sport Gloves', 'Vice')
		]);

		expect(coverage.find((entry) => entry.entry.id === 'knife')?.curated).toBe(1);
		expect(coverage.find((entry) => entry.entry.id === 'gloves')?.curated).toBe(1);
	});

	it('reports zero rather than omitting a slot with nothing curated', () => {
		const coverage = smartCoreCoverage(CATALOG, []);

		expect(coverage.every((entry) => entry.curated === 0)).toBe(true);
		expect(coverage).toHaveLength(SMART_CORE.length);
	});

	it('ignores a curated record that does not belong to the slot', () => {
		const coverage = smartCoreCoverage(CATALOG, [record('AK-47', 'Redline')]);

		expect(coverage.find((entry) => entry.entry.id === 'awp')?.curated).toBe(0);
	});
});
