/**
 * The loadout builder's skin picker, for the browser.
 *
 * **The catalog never ships wholesale to the client.** Nearly two thousand
 * skins with every variant attached is megabytes the browser has no use for,
 * so the picker asks for one bounded, slot-scoped page at a time and this is
 * the seam that answers.
 *
 * Reads the cached catalog index, so browsing costs **zero upstream
 * requests** — market traffic starts only when someone asks for prices.
 */
import { json } from '@sveltejs/kit';
import { parseBuildSkinsQuery } from '$lib/schemas/loadout';
import { searchSlotSkins } from '$lib/server/services/loadout';
import type { LoadoutSkinPage } from '$lib/types/loadout';
import type { RequestHandler } from './$types';

export type BuildSkinsResponse = LoadoutSkinPage;

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	let query;

	try {
		query = parseBuildSkinsQuery(url.searchParams);
	} catch {
		// The caller's own input, so it is safe to name; nothing about the
		// catalog or the upstream is revealed.
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	try {
		const page = await searchSlotSkins(query.slot, { q: query.q, page: query.page }, { fetch });

		// An unknown slot is a client error, not an empty result: answering
		// with zero skins would look like "this slot has nothing".
		if (!page) return json({ error: 'Unknown slot' }, { status: 400 });

		// Same slot and query, same answer, for as long as the index lives.
		setHeaders({ 'cache-control': 'public, max-age=60' });

		return json(page satisfies BuildSkinsResponse);
	} catch {
		// Whatever failed upstream is ours to deal with, not the visitor's to
		// read. No status code, no provider name, no error payload.
		return json({ error: 'Skins are temporarily unavailable' }, { status: 503 });
	}
};
