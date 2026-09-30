/**
 * Validation for the Smart Loadout request.
 *
 * The browser sends **preferences and nothing else**. It does not name slots,
 * candidates, skins or item ids — the server owns the Smart Core, the curated
 * dataset and the candidate logic, so a crafted payload cannot turn this into
 * an arbitrary market-query endpoint.
 */
import { z } from 'zod';
import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';

/**
 * The largest budget worth accepting.
 *
 * R$ 10 million in minor units. Nothing in the catalog approaches it; the
 * limit exists so an absurd number cannot reach the optimizer, not to express
 * a product opinion about what people spend.
 */
export const MAX_BUDGET_MINOR = 1_000_000_000;

export const smartLoadoutRequestSchema = z
	.object({
		budgetMinor: z.number().int().positive().max(MAX_BUDGET_MINOR),
		color: z.enum(SKIN_COLORS).optional(),
		style: z.enum(SKIN_STYLES).optional(),
		includeKnife: z.boolean().default(false),
		includeGloves: z.boolean().default(false)
	})
	.strict()
	.refine((request) => Boolean(request.color || request.style), {
		// Without a visual direction this is a cheapest-loadout generator, not
		// a Smart one — and it would quietly become the product's main path.
		message: 'Choose a colour or a style',
		path: ['color']
	});

export type SmartLoadoutRequest = z.infer<typeof smartLoadoutRequestSchema>;

/**
 * A well-formed pt-BR amount, and nothing else.
 *
 * ```text
 *  1500   1.500   1.500,00   10,50
 *  ^^^^   ^^^^^   ^^^^^^^^   ^^^^^
 *  plain  grouped  grouped   decimal
 *                + decimal
 * ```
 *
 * - **A comma is the decimal mark**, appears at most once, and takes one or
 *   two digits. Three digits after a comma is not a thousands group being
 *   written the wrong way round — it is a typo, and reading `10,555` as
 *   `R$ 10.555,00` would hand someone a budget a thousand times what they
 *   meant.
 * - **A dot is grouping**, and grouping has to be real: one to three digits,
 *   then whole groups of three. That rejects `1.500.00`, `1..500` and
 *   `1234.500`.
 * - Anything with two commas, stray separators or internal spaces is
 *   ambiguous, and an ambiguous amount of money is not worth guessing at.
 */
const BRL_AMOUNT = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;

/**
 * Reads a BRL amount typed by a person into exact minor units.
 *
 * Money never becomes a float on the way in: `1.500,50` is parsed to `150050`
 * by moving the separator, not by multiplying by 100.
 *
 * Deliberately strict — see `BRL_AMOUNT`. The alternative is a parser that
 * always returns *a* number, which for money means confidently returning the
 * wrong one. Returning nothing lets the form say so while the visitor is still
 * looking at what they typed.
 */
export function parseBudgetMinor(input: string): number | undefined {
	// Surrounding whitespace and the currency symbol are presentation, not
	// value. Whitespace *inside* the number is not tolerated: `2 000` could be
	// grouping or two numbers, and we do not guess.
	const trimmed = input
		.trim()
		.replace(/^R\$\s*/i, '')
		.trimStart();

	const match = BRL_AMOUNT.exec(trimmed);
	if (!match) return undefined;

	const whole = match[1].replaceAll('.', '');
	const fraction = (match[2] ?? '').padEnd(2, '0');

	// String concatenation, not arithmetic: no multiply, no rounding, no float.
	const minor = Number(`${whole}${fraction}`);

	return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_BUDGET_MINOR ? minor : undefined;
}
