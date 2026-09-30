/**
 * What a loadout looks like when it leaves the page — saved on this device, or
 * carried in a link.
 *
 * Both formats store **canonical application identity and nothing else**: a
 * slot, a route slug, and a variant in our own vocabulary. No catalog item id,
 * no market hash name, no price, no provider, no image URL. Two reasons, and
 * both matter:
 *
 * - Anything from upstream would tie a saved loadout to someone else's
 *   numbering, so a renumbering upstream would silently break every saved and
 *   shared loadout.
 * - Anything from the market would be stale the moment it was written, and a
 *   stale price restored as if it were current is worse than no price.
 *
 * Everything else is re-resolved against the catalog on the way back in.
 */
import { z } from 'zod';
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import { loadoutSelectionSchema } from './loadout';

/**
 * The one key the builder owns in `localStorage`.
 *
 * Namespaced and versioned in the key itself, so a future format can live
 * beside this one rather than having to interpret it. Written once, here —
 * a string literal repeated across modules is a bug waiting for a typo.
 */
export const BUILDER_STORAGE_KEY = 'cs2-skins:builder:v1';

/** The only persisted schema version this build understands. */
export const PERSISTED_LOADOUT_VERSION = 1;

/**
 * A saved loadout.
 *
 * `version` is checked rather than assumed: a payload written by a future
 * build must be discarded, not reinterpreted as v1. Reading is otherwise
 * strict — an unknown field means the payload is not what we think it is.
 */
export const persistedLoadoutSchema = z
	.object({
		version: z.literal(PERSISTED_LOADOUT_VERSION),
		selections: z
			.array(loadoutSelectionSchema)
			// Zero is allowed on the way in so an empty payload written by an
			// older build still parses; the writer removes the key instead.
			.max(LOADOUT_SLOTS.length)
			.refine(
				(selections) => new Set(selections.map((entry) => entry.slotId)).size === selections.length,
				'A slot can hold only one skin'
			)
	})
	.strict();

export type PersistedLoadout = z.infer<typeof persistedLoadoutSchema>;

/**
 * A resolve request: canonical selections in, current catalog data out.
 *
 * Deliberately **not** `loadoutPricingRequestSchema`. Pricing is strict — it
 * spends a metered request, so a request that is half wrong is rejected whole.
 * Restoring is tolerant: a saved loadout that lost one skin to a game update
 * should come back missing one skin, not missing everything. So this accepts
 * an empty list and leaves per-selection judgement to the resolver.
 */
export const loadoutResolveRequestSchema = z
	.object({
		selections: z.array(loadoutSelectionSchema).max(LOADOUT_SLOTS.length)
	})
	.strict();

export type LoadoutResolveRequest = z.infer<typeof loadoutResolveRequestSchema>;
