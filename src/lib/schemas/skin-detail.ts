/**
 * The variant selection carried in a skin page's query string.
 *
 * The route identifies the *product* — `AK-47 | Redline` — and these describe
 * which of its variants is being looked at. They are written in our own
 * vocabulary rather than upstream identifiers, so the URL stays readable and
 * stays ours: `?wear=Field-Tested&edition=stattrak`, never `?item_id=12633`.
 */
import { z } from 'zod';

/**
 * The finish editions a skin can be sold in.
 *
 * `normal` is a real value rather than the absence of one — it lets a URL say
 * "the plain version" explicitly when switching away from StatTrak.
 */
export const SKIN_EDITIONS = ['normal', 'stattrak', 'souvenir'] as const;

export type SkinEdition = (typeof SKIN_EDITIONS)[number];

/** Exteriors, best condition first. Also the fallback order when unspecified. */
export const WEAR_ORDER = [
	'Factory New',
	'Minimal Wear',
	'Field-Tested',
	'Well-Worn',
	'Battle-Scarred'
] as const;

const optionalText = z
	.string()
	.trim()
	.max(64)
	.transform((value) => (value.length > 0 ? value : undefined))
	.optional();

export const skinSelectionSchema = z.object({
	/** Exterior name, e.g. `Field-Tested`. Matched against real variants. */
	wear: optionalText,
	edition: z
		.string()
		.optional()
		.transform((value) => {
			const edition = value?.trim().toLowerCase();

			return (SKIN_EDITIONS as readonly string[]).includes(edition ?? '')
				? (edition as SkinEdition)
				: undefined;
		}),
	/** Phase label for phased finishes, e.g. `Phase 2`. */
	phase: optionalText
});

/**
 * A variant selection. Every field is optional — an absent one means "no
 * preference", which is what an unadorned product URL expresses.
 */
export type SkinSelection = Partial<z.infer<typeof skinSelectionSchema>>;

/**
 * Parses a selection from the URL.
 *
 * Total by design: an unrecognised value becomes "unspecified" and the page
 * falls back to a sensible variant. Someone mistyping a query parameter should
 * see a skin, not an error.
 */
export function parseSkinSelection(params: URLSearchParams): SkinSelection {
	return skinSelectionSchema.parse({
		wear: params.get('wear') ?? undefined,
		edition: params.get('edition') ?? undefined,
		phase: params.get('phase') ?? undefined
	});
}
