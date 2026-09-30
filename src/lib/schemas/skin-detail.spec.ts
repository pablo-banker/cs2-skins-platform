import { describe, expect, it } from 'vitest';
import { parseSkinSelection, SKIN_EDITIONS, WEAR_ORDER } from './skin-detail';

const parse = (search: string) => parseSkinSelection(new URLSearchParams(search));

describe('parseSkinSelection', () => {
	it('reads a full selection', () => {
		expect(parse('wear=Field-Tested&edition=stattrak&phase=Phase+2')).toEqual({
			wear: 'Field-Tested',
			edition: 'stattrak',
			phase: 'Phase 2'
		});
	});

	it('treats an empty URL as no preference', () => {
		expect(parse('')).toEqual({ wear: undefined, edition: undefined, phase: undefined });
	});

	it('accepts an edition in any casing', () => {
		expect(parse('edition=StatTrak').edition).toBe('stattrak');
		expect(parse('edition=SOUVENIR').edition).toBe('souvenir');
	});

	it('drops an edition it does not recognise rather than failing', () => {
		// A mistyped parameter should show a skin, not an error page.
		for (const search of ['edition=gold', 'edition=', 'edition=%20']) {
			expect(parse(search).edition, search).toBeUndefined();
		}
	});

	it('trims and drops blank text', () => {
		expect(parse('wear=%20%20').wear).toBeUndefined();
		expect(parse('wear=%20Field-Tested%20').wear).toBe('Field-Tested');
	});

	it('bounds an over-long value instead of passing it on', () => {
		expect(() => parse(`wear=${'a'.repeat(200)}`)).toThrow();
	});
});

describe('vocabularies', () => {
	it('names the three finishes', () => {
		expect(SKIN_EDITIONS).toEqual(['normal', 'stattrak', 'souvenir']);
	});

	it('orders exteriors by condition', () => {
		expect(WEAR_ORDER[0]).toBe('Factory New');
		expect(WEAR_ORDER.at(-1)).toBe('Battle-Scarred');
	});
});
