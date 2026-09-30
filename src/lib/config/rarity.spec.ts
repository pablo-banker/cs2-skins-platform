import { describe, expect, it } from 'vitest';
import { rarityIndicatorClass, rarityTier } from './rarity';

describe('rarityTier', () => {
	it('maps the weapon rarity ladder', () => {
		expect(rarityTier('Consumer Grade')).toBe('consumer');
		expect(rarityTier('Industrial Grade')).toBe('industrial');
		expect(rarityTier('Mil-Spec Grade')).toBe('mil-spec');
		expect(rarityTier('Restricted')).toBe('restricted');
		expect(rarityTier('Classified')).toBe('classified');
		expect(rarityTier('Covert')).toBe('covert');
		expect(rarityTier('Contraband')).toBe('contraband');
	});

	it('maps the parallel agent and collectible names onto the same rungs', () => {
		// Verified against the live catalog: these names report the same colour.
		expect(rarityTier('Base Grade')).toBe('consumer');
		expect(rarityTier('High Grade')).toBe('mil-spec');
		expect(rarityTier('Distinguished')).toBe('mil-spec');
		expect(rarityTier('Remarkable')).toBe('restricted');
		expect(rarityTier('Exceptional')).toBe('restricted');
		expect(rarityTier('Exotic')).toBe('classified');
		expect(rarityTier('Superior')).toBe('classified');
		expect(rarityTier('Extraordinary')).toBe('covert');
		expect(rarityTier('Master')).toBe('covert');
	});

	it('ignores case and surrounding whitespace', () => {
		expect(rarityTier('  covert ')).toBe('covert');
		expect(rarityTier('MIL-SPEC GRADE')).toBe('mil-spec');
	});

	it('returns null for an unknown or missing rarity', () => {
		expect(rarityTier('Mythical Ultra Rare')).toBeNull();
		expect(rarityTier(undefined)).toBeNull();
		expect(rarityTier('')).toBeNull();
	});
});

describe('rarityIndicatorClass', () => {
	it('uses a design-system rarity token, never an upstream hex', () => {
		expect(rarityIndicatorClass({ name: 'Covert', color: '#EB4B4B' })).toBe('bg-rarity-covert');
		expect(rarityIndicatorClass({ name: 'Classified' })).toBe('bg-rarity-classified');
	});

	it('falls back to neutral for an unknown rarity instead of guessing a colour', () => {
		expect(rarityIndicatorClass({ name: 'Mythical Ultra Rare' })).toBe('bg-muted-foreground');
		expect(rarityIndicatorClass(null)).toBe('bg-muted-foreground');
	});
});
