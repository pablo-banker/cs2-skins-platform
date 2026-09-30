/**
 * Validation for the builder's two endpoints.
 *
 * Both take input from the browser, so both are parsed as strictly as an
 * external payload. A pricing request in particular is a list of things to go
 * and ask a metered API about — it does not get to be vague.
 */
import { z } from 'zod';
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import { SKIN_EDITIONS } from './skin-detail';

/** Picker page size. Bounded so a knife slot cannot return 428 options. */
export const BUILD_PAGE_SIZE = 20;

const slotId = z.string().trim().min(1).max(40);

const skinSlug = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a skin slug');

export const buildSkinsQuerySchema = z.object({
	slot: slotId,
	q: z.string().trim().max(100).optional(),
	page: z.coerce.number().int().min(1).max(200).catch(1)
});

export type BuildSkinsQuery = z.infer<typeof buildSkinsQuerySchema>;

export function parseBuildSkinsQuery(params: URLSearchParams): BuildSkinsQuery {
	return buildSkinsQuerySchema.parse({
		slot: params.get('slot') ?? '',
		q: params.get('q') ?? undefined,
		page: params.get('page') ?? 1
	});
}

/**
 * One selection, in **our** identity: a slot, a route slug and a variant
 * described the way a URL describes it. Never a catalog item id — see
 * `src/lib/types/loadout.ts`.
 */
export const loadoutSelectionSchema = z
	.object({
		slotId,
		skinSlug,
		variant: z
			.object({
				wear: z.string().trim().min(1).max(64).optional(),
				edition: z.enum(SKIN_EDITIONS).optional(),
				phase: z.string().trim().min(1).max(64).optional()
			})
			.strict()
			.default({})
	})
	.strict();

/**
 * A pricing request.
 *
 * Capped at the number of configured slots, because that is the largest
 * loadout the product can express — and a request claiming more is not a large
 * loadout, it is a malformed one. Duplicate slots are rejected rather than
 * deduplicated: silently dropping half a request and pricing the rest would
 * answer a question nobody asked.
 */
export const loadoutPricingRequestSchema = z
	.object({
		selections: z
			.array(loadoutSelectionSchema)
			.min(1)
			.max(LOADOUT_SLOTS.length)
			.refine(
				(selections) => new Set(selections.map((entry) => entry.slotId)).size === selections.length,
				'A slot can hold only one skin'
			)
	})
	.strict();

export type LoadoutPricingRequest = z.infer<typeof loadoutPricingRequestSchema>;
