/**
 * Current catalog data for a set of selections.
 *
 * What a saved or shared loadout needs to become something renderable. The
 * browser holds canonical identity — slot, slug, variant — and nothing about
 * how a skin looks or what it is called today; this is where that is filled in
 * without shipping the catalog to the client.
 *
 * **Catalog only.** No price request, no provider directory, no history. A
 * restored loadout starts with prices uncalculated, exactly as a fresh one
 * does, because a total from before the reload would be someone else's number.
 */
import { json } from '@sveltejs/kit';
import { loadoutResolveRequestSchema } from '$lib/schemas/loadout-persistence';
import { resolveSelectionsTolerantly, type LoadoutResolution } from '$lib/server/services/loadout';
import type { RequestHandler } from './$types';

export type LoadoutResolveResponse = LoadoutResolution;

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const parsed = loadoutResolveRequestSchema.safeParse(body);

	// A payload that is not even shaped like selections is a client error. A
	// payload of selections that no longer exist is not — that is what the
	// tolerant resolver is for, and it answers 200 with them listed as
	// rejected.
	if (!parsed.success) return json({ error: 'Invalid loadout' }, { status: 400 });

	try {
		return json(
			(await resolveSelectionsTolerantly(parsed.data.selections, {
				fetch
			})) satisfies LoadoutResolveResponse
		);
	} catch {
		// Only the catalog itself can fail here. Nothing about the upstream
		// reaches the visitor.
		return json({ error: 'Your loadout could not be restored' }, { status: 503 });
	}
};
