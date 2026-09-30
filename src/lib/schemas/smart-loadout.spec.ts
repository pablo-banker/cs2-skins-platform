import { describe, expect, it } from 'vitest';
import { MAX_BUDGET_MINOR, parseBudgetMinor, smartLoadoutRequestSchema } from './smart-loadout';

describe('parseBudgetMinor', () => {
	it('reads the format the interface prints', () => {
		expect(parseBudgetMinor('R$ 1.500,00')).toBe(150_000);
		expect(parseBudgetMinor('R$ 2.000,00')).toBe(200_000);
		expect(parseBudgetMinor('R$ 1.234,56')).toBe(123_456);
		expect(parseBudgetMinor('R$ 142,50')).toBe(14_250);
	});

	it('reads every clean form of the same amount', () => {
		expect(parseBudgetMinor('1500')).toBe(150_000);
		expect(parseBudgetMinor('1500,00')).toBe(150_000);
		expect(parseBudgetMinor('1.500')).toBe(150_000);
		expect(parseBudgetMinor('1.500,00')).toBe(150_000);
		expect(parseBudgetMinor('R$ 1.500,00')).toBe(150_000);
	});

	it('reads plain digits, because people type those', () => {
		expect(parseBudgetMinor('2000')).toBe(200_000);
		expect(parseBudgetMinor('10,50')).toBe(1050);
		expect(parseBudgetMinor('1234567')).toBe(123_456_700);
	});

	it('takes a dot as grouping and a comma as the decimal mark', () => {
		expect(parseBudgetMinor('1.234.567,89')).toBe(123_456_789);
		expect(parseBudgetMinor('2.000')).toBe(200_000);
		expect(parseBudgetMinor('10.555')).toBe(1_055_500);
	});

	it('pads a single decimal digit', () => {
		expect(parseBudgetMinor('R$ 10,5')).toBe(1050);
		expect(parseBudgetMinor('2000,5')).toBe(200_050);
	});

	it('tolerates surrounding whitespace and a missing symbol', () => {
		expect(parseBudgetMinor('  R$2.000,00  ')).toBe(200_000);
		expect(parseBudgetMinor('r$ 2000')).toBe(200_000);
		expect(parseBudgetMinor('\t1.500,00\n')).toBe(150_000);
	});

	it('never goes through a float', () => {
		// 0.1 + 0.2 territory: every one of these is exact by construction
		// because the separator moves, nothing multiplies.
		expect(parseBudgetMinor('0,29')).toBe(29);
		expect(parseBudgetMinor('1,15')).toBe(115);
		expect(parseBudgetMinor('8,05')).toBe(805);
		expect(parseBudgetMinor('1.000.000,07')).toBe(100_000_007);
	});

	it('refuses three digits after the comma rather than re-reading them', () => {
		// The one case worth stating on its own. Reading `10,555` as
		// R$ 10.555,00 would hand someone a budget a thousand times what they
		// meant; `10.555` is how that amount is written.
		expect(parseBudgetMinor('10,555')).toBeUndefined();
		expect(parseBudgetMinor('1,2345')).toBeUndefined();
	});

	it('refuses a mixed or repeated separator', () => {
		for (const input of ['10,5,5', '1,500,00', '1..500', '1.500.00', '1,234.56', '1.2.3']) {
			expect(parseBudgetMinor(input), input).toBeUndefined();
		}
	});

	it('refuses grouping that is not grouping', () => {
		// A dot only means thousands when the groups are whole.
		for (const input of ['1234.500', '1.5000', '1.50', '.500', '1.']) {
			expect(parseBudgetMinor(input), input).toBeUndefined();
		}
	});

	it('refuses whitespace inside the number', () => {
		// `2 000` could be grouping or two numbers. We do not guess about money.
		expect(parseBudgetMinor('2 000,00')).toBeUndefined();
		expect(parseBudgetMinor('1 500')).toBeUndefined();
	});

	it('refuses what is not an amount at all', () => {
		for (const input of [
			'',
			'   ',
			'R$',
			'R$ ',
			'R$ abc',
			'abc',
			'lots',
			'-100',
			'1e5',
			',50',
			'1,2e3',
			'+500',
			'R$1,00x'
		]) {
			expect(parseBudgetMinor(input), JSON.stringify(input)).toBeUndefined();
		}
	});

	it('refuses zero and anything below a cent', () => {
		expect(parseBudgetMinor('0')).toBeUndefined();
		expect(parseBudgetMinor('0,00')).toBeUndefined();
		expect(parseBudgetMinor('R$ 0,00')).toBeUndefined();
		expect(parseBudgetMinor('0,01')).toBe(1);
	});

	it('refuses an amount past the ceiling', () => {
		expect(parseBudgetMinor('10.000.000,00')).toBe(MAX_BUDGET_MINOR);
		expect(parseBudgetMinor('10.000.000,01')).toBeUndefined();
		expect(parseBudgetMinor('99.999.999.999,99')).toBeUndefined();
	});

	it('returns exact integer minor units, never a float', () => {
		for (const input of ['1500', '1500,00', '1.500', '1.500,00', 'R$ 1.500,00', '10,50']) {
			const parsed = parseBudgetMinor(input);

			expect(Number.isInteger(parsed), input).toBe(true);
		}
	});
});

const VALID = { budgetMinor: 200_000, color: 'red' };

describe('smartLoadoutRequestSchema', () => {
	it('accepts a colour on its own', () => {
		const parsed = smartLoadoutRequestSchema.safeParse(VALID);

		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data).toEqual({
			budgetMinor: 200_000,
			color: 'red',
			includeKnife: false,
			includeGloves: false
		});
	});

	it('accepts a style on its own', () => {
		expect(smartLoadoutRequestSchema.safeParse({ budgetMinor: 1, style: 'clean' }).success).toBe(
			true
		);
	});

	it('requires a visual direction', () => {
		// Without one this is a cheapest-loadout generator, not a Smart one.
		expect(smartLoadoutRequestSchema.safeParse({ budgetMinor: 200_000 }).success).toBe(false);
	});

	it('requires a positive integer budget', () => {
		for (const budgetMinor of [0, -1, 1.5, '200000', null, undefined, Number.NaN, Infinity]) {
			expect(
				smartLoadoutRequestSchema.safeParse({ ...VALID, budgetMinor }).success,
				String(budgetMinor)
			).toBe(false);
		}
	});

	it('caps the budget', () => {
		expect(
			smartLoadoutRequestSchema.safeParse({ ...VALID, budgetMinor: MAX_BUDGET_MINOR }).success
		).toBe(true);
		expect(
			smartLoadoutRequestSchema.safeParse({ ...VALID, budgetMinor: MAX_BUDGET_MINOR + 1 }).success
		).toBe(false);
	});

	it('only knows the shared taxonomy', () => {
		expect(smartLoadoutRequestSchema.safeParse({ ...VALID, color: 'burgundy' }).success).toBe(
			false
		);
		expect(smartLoadoutRequestSchema.safeParse({ ...VALID, color: 'Red' }).success).toBe(false);
		expect(smartLoadoutRequestSchema.safeParse({ budgetMinor: 1, style: 'gothic' }).success).toBe(
			false
		);
	});

	it('refuses anything beyond preferences', () => {
		// The contract that stops this becoming an arbitrary market query.
		for (const extra of [
			{ slotId: 'ak-47' },
			{ itemIds: [1] },
			{ skinSlug: 'ak-47-redline' },
			{ candidatesPerEntry: 500 },
			{ currency: 'USD' }
		]) {
			expect(
				smartLoadoutRequestSchema.safeParse({ ...VALID, ...extra }).success,
				JSON.stringify(extra)
			).toBe(false);
		}
	});

	it('defaults both extras to off', () => {
		const parsed = smartLoadoutRequestSchema.safeParse(VALID);

		expect(parsed.success && parsed.data.includeKnife).toBe(false);
		expect(parsed.success && parsed.data.includeGloves).toBe(false);
	});

	it('takes the extras as booleans only', () => {
		expect(smartLoadoutRequestSchema.safeParse({ ...VALID, includeKnife: 'yes' }).success).toBe(
			false
		);
		expect(smartLoadoutRequestSchema.safeParse({ ...VALID, includeKnife: 1 }).success).toBe(false);
	});
});
