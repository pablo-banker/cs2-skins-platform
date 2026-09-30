import { describe, expect, it } from 'vitest';
import { assignSkinSlugs, toSkinSlugBase } from './skin-slug';
import type { Skin } from '$lib/types/skin';

function skin(weapon: string, name: string, itemId = 1): Skin {
	return {
		id: 'placeholder',
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		variants: [{ itemId, marketHashName: `${weapon} | ${name}`, statTrak: false, souvenir: false }]
	};
}

describe('toSkinSlugBase', () => {
	it('builds a readable ASCII slug', () => {
		expect(toSkinSlugBase('AK-47', 'Redline')).toBe('ak-47-redline');
		expect(toSkinSlugBase('★ Karambit', 'Doppler')).toBe('karambit-doppler');
		expect(toSkinSlugBase('M4A1-S', 'Player Two')).toBe('m4a1-s-player-two');
	});
});

describe('assignSkinSlugs', () => {
	it('gives every skin a unique slug and stamps it on the id', () => {
		const bySlug = assignSkinSlugs([skin('AK-47', 'Redline'), skin('AWP', 'Asiimov')]);

		expect([...bySlug.keys()].sort()).toEqual(['ak-47-redline', 'awp-asiimov']);
		expect(bySlug.get('ak-47-redline')?.id).toBe('ak-47-redline');
	});

	it('disambiguates a real collision instead of losing a skin', () => {
		// Measured in the live catalog: the Japanese numerals do not survive
		// slugification, so both finishes would otherwise share one URL.
		const bySlug = assignSkinSlugs([
			skin('Desert Eagle', 'Sunset Storm 壱', 10),
			skin('Desert Eagle', 'Sunset Storm 弐', 11)
		]);

		expect(bySlug.size).toBe(2);
		expect(bySlug.get('desert-eagle-sunset-storm')?.name).toBe('Sunset Storm 壱');
		expect(bySlug.get('desert-eagle-sunset-storm-2')?.name).toBe('Sunset Storm 弐');
	});

	it('resolves a collision the same way whatever order the catalog arrives in', () => {
		const a = skin('Desert Eagle', 'Sunset Storm 壱', 10);
		const b = skin('Desert Eagle', 'Sunset Storm 弐', 11);

		const forward = assignSkinSlugs([a, b]);
		const reversed = assignSkinSlugs([b, a]);

		expect(forward.get('desert-eagle-sunset-storm')?.name).toBe(
			reversed.get('desert-eagle-sunset-storm')?.name
		);
	});

	it('falls back to an id-based slug when a name yields nothing sluggable', () => {
		const bySlug = assignSkinSlugs([skin('壱', '弐', 77)]);

		expect([...bySlug.keys()]).toEqual(['skin-77']);
	});

	it('does not mutate the skins it was given', () => {
		const original = skin('AK-47', 'Redline');
		assignSkinSlugs([original]);

		expect(original.id).toBe('placeholder');
	});
});
