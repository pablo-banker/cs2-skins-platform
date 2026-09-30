import { describe, expect, it } from 'vitest';
import { pickSlotOptions, toSkinOption } from './picker';
import { getLoadoutSlot } from '$lib/config/loadout';
import type { Skin, SkinVariant } from '$lib/types/skin';

function variant(itemId: number, overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId,
		marketHashName: `item-${itemId}`,
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false,
		minFloat: 0.15,
		maxFloat: 0.38,
		...overrides
	};
}

function skin(
	weapon: string,
	name: string,
	itemSubtype: string,
	variants: SkinVariant[] = [variant(1)]
): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-') || weapon.toLowerCase(),
		weapon,
		name,
		fullName: name ? `${weapon} | ${name}` : weapon,
		imageUrl: `https://cdn.example.test/${weapon}.png`,
		rarity: { name: 'Covert', color: '#EB4B4B' },
		weaponType: 'Assault Rifle',
		itemSubtype,
		collection: 'The Phoenix Collection',
		variants
	};
}

const INDEX: Skin[] = [
	skin('AK-47', 'Redline', 'Rifles'),
	skin('AK-47', 'Asiimov', 'Rifles'),
	skin('AK-47', 'Slate', 'Rifles'),
	skin('M4A4', 'Howl', 'Rifles'),
	skin('AWP', 'Asiimov', 'Rifles'),
	skin('Karambit', 'Doppler', 'Knives'),
	skin('Bayonet', '', 'Knives', [variant(9, { wear: 'Not Painted' })]),
	skin('Sport Gloves', 'Vice', 'Gloves')
];

const ak = getLoadoutSlot('ak-47')!;
const knife = getLoadoutSlot('knife')!;
const gloves = getLoadoutSlot('gloves')!;

describe('toSkinOption', () => {
	it('narrows a catalog skin to what the picker renders', () => {
		const option = toSkinOption(skin('AK-47', 'Redline', 'Rifles'));

		expect(Object.keys(option).sort()).toEqual([
			'fullName',
			'imageUrl',
			'name',
			'rarity',
			'slug',
			'variants',
			'weapon'
		]);
	});

	it('leaves catalog internals behind', () => {
		const option = toSkinOption(skin('AK-47', 'Redline', 'Rifles'));
		const serialized = JSON.stringify(option);

		// The picker draws none of these, and a float is explicitly out of the
		// product's scope.
		expect(serialized).not.toContain('marketHashName');
		expect(serialized).not.toContain('minFloat');
		expect(serialized).not.toContain('collection');
		expect(serialized).not.toContain('weaponType');
		expect(serialized).not.toContain('itemSubtype');
	});

	it('carries the real variants, so an exact choice is possible', () => {
		const option = toSkinOption(
			skin('AK-47', 'Redline', 'Rifles', [
				variant(2, { wear: 'Minimal Wear' }),
				variant(1, { wear: 'Factory New' }),
				variant(3, { wear: 'Factory New', statTrak: true })
			])
		);

		// Ordered the way the selectors present them: plain first, then best
		// condition — the same order the skin page uses.
		expect(option.variants.map((entry) => [entry.wear, entry.statTrak])).toEqual([
			['Factory New', false],
			['Minimal Wear', false],
			['Factory New', true]
		]);
	});

	it('keeps a vanilla knife identifiable by its weapon name', () => {
		const option = toSkinOption(skin('Bayonet', '', 'Knives'));

		expect(option.name).toBe('');
		expect(option.fullName).toBe('Bayonet');
		expect(option.weapon).toBe('Bayonet');
	});
});

describe('pickSlotOptions', () => {
	it('returns only the skins a firearm slot accepts', () => {
		const page = pickSlotOptions(INDEX, ak, { page: 1 });

		expect(page.options.map((option) => option.name)).toEqual(['Asiimov', 'Redline', 'Slate']);
		expect(page.total).toBe(3);
	});

	it('never leaks another weapon into a slot', () => {
		const page = pickSlotOptions(INDEX, ak, { page: 1 });

		expect(page.options.every((option) => option.weapon === 'AK-47')).toBe(true);
	});

	it('returns every knife family in the knife slot', () => {
		const page = pickSlotOptions(INDEX, knife, { page: 1 });

		expect(page.options.map((option) => option.weapon).sort()).toEqual(['Bayonet', 'Karambit']);
	});

	it('returns gloves in the gloves slot and nothing else', () => {
		const page = pickSlotOptions(INDEX, gloves, { page: 1 });

		expect(page.options).toHaveLength(1);
		expect(page.options[0].weapon).toBe('Sport Gloves');
	});

	it('sorts alphabetically when there is no query', () => {
		// No query means no notion of "best match"; a stable list scans better.
		const page = pickSlotOptions(INDEX, ak, { page: 1 });

		expect(page.options.map((option) => option.fullName)).toEqual([
			'AK-47 | Asiimov',
			'AK-47 | Redline',
			'AK-47 | Slate'
		]);
	});

	it('filters by query within the slot', () => {
		const page = pickSlotOptions(INDEX, ak, { q: 'redline', page: 1 });

		expect(page.options.map((option) => option.name)).toEqual(['Redline']);
		expect(page.total).toBe(1);
	});

	it('does not let a query escape the slot', () => {
		// "Asiimov" exists on the AWP too; the AK slot must not offer it.
		const page = pickSlotOptions(INDEX, ak, { q: 'asiimov', page: 1 });

		expect(page.options.every((option) => option.weapon === 'AK-47')).toBe(true);
	});

	it('ranks an exact finish above a partial match', () => {
		const index = [skin('AK-47', 'Redline Reloaded', 'Rifles'), skin('AK-47', 'Redline', 'Rifles')];

		const page = pickSlotOptions(index, ak, { q: 'redline', page: 1 });

		expect(page.options[0].name).toBe('Redline');
	});

	it('matches through punctuation, like every other search in the product', () => {
		const index = [skin('Karambit', 'Doppler', 'Knives')];

		expect(pickSlotOptions(index, knife, { q: 'karambit doppler', page: 1 }).total).toBe(1);
	});

	it('returns nothing rather than everything when a query matches nothing', () => {
		const page = pickSlotOptions(INDEX, ak, { q: 'zzzznothing', page: 1 });

		expect(page.options).toEqual([]);
		expect(page.total).toBe(0);
		expect(page.pageCount).toBe(1);
	});

	it('pages bounded results', () => {
		const many = Array.from({ length: 25 }, (_, index) =>
			skin('AK-47', `Finish ${String(index).padStart(2, '0')}`, 'Rifles')
		);

		const first = pickSlotOptions(many, ak, { page: 1 }, 10);
		const last = pickSlotOptions(many, ak, { page: 3 }, 10);

		expect(first.options).toHaveLength(10);
		expect(first.total).toBe(25);
		expect(first.pageCount).toBe(3);
		expect(last.options).toHaveLength(5);
		expect(last.page).toBe(3);
	});

	it('clamps a page beyond the end rather than returning nothing', () => {
		const page = pickSlotOptions(INDEX, ak, { page: 99 }, 2);

		expect(page.page).toBe(2);
		expect(page.options.length).toBeGreaterThan(0);
	});

	it('never returns a whole knife family in one response', () => {
		const many = Array.from({ length: 400 }, (_, index) =>
			skin('Karambit', `Finish ${index}`, 'Knives')
		);

		expect(pickSlotOptions(many, knife, { page: 1 }).options.length).toBeLessThanOrEqual(20);
	});

	it('does not mutate the index it was given', () => {
		const index = [...INDEX];
		const snapshot = structuredClone(index);

		pickSlotOptions(index, ak, { q: 'redline', page: 1 });

		expect(index).toEqual(snapshot);
	});

	it('names the slot it answered for', () => {
		expect(pickSlotOptions(INDEX, ak, { page: 1 }).slotId).toBe('ak-47');
	});
});
