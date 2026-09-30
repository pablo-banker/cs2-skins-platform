/**
 * Current prices for a loadout, on request.
 *
 * Deliberately a `POST` the visitor triggers rather than something that fires
 * after every click: a full loadout is far larger than an editorial kit, and
 * pricing one on each edit would spend a metered quota on a loadout nobody had
 * finished building.
 *
 * The request speaks **our** identity — slot, skin slug, variant — never
 * catalog item ids. The server resolves those itself, and validates every
 * selection before spending a request on it.
 */
import { json } from '@sveltejs/kit';
import { loadoutPricingRequestSchema } from '$lib/schemas/loadout';
import { LoadoutSelectionError, priceLoadout } from '$lib/server/services/loadout';
import type { LoadoutPricingResult } from '$lib/types/loadout';
import type { RequestHandler } from './$types';

export type LoadoutPricesResponse = LoadoutPricingResult;

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const parsed = loadoutPricingRequestSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: 'Invalid loadout' }, { status: 400 });
	}

	try {
		return json(
			(await priceLoadout(parsed.data.selections, { fetch })) satisfies LoadoutPricesResponse
		);
	} catch (cause) {
		// A selection that does not describe a real, slot-compatible variant is
		// the caller's error — but the message stays generic, because the
		// detail is about our catalog, not their request.
		if (cause instanceof LoadoutSelectionError) {
			return json({ error: 'Invalid loadout' }, { status: 400 });
		}

		return json({ error: 'Current prices could not be loaded' }, { status: 503 });
	}
};
