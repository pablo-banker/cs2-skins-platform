/**
 * Generates a loadout, on request.
 *
 * The browser sends **preferences and nothing else** — a budget and a visual
 * direction. It does not name slots, skins, candidates or item ids: the server
 * owns the Smart Core, the curated dataset and the candidate logic, so a
 * crafted payload cannot turn this into an arbitrary market-query endpoint.
 *
 * Deliberately a `POST` someone presses. A generation prices a few dozen
 * candidates, so it happens when a person asks for it and never as a side
 * effect of typing in a form.
 */
import { json } from '@sveltejs/kit';
import { smartLoadoutRequestSchema } from '$lib/schemas/smart-loadout';
import { generateSmartLoadout } from '$lib/server/services/smart-loadout';
import type { SmartGenerationResult } from '$lib/types/smart-loadout';
import type { RequestHandler } from './$types';

export type SmartGenerateResponse = SmartGenerationResult;

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const parsed = smartLoadoutRequestSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: 'Invalid preferences' }, { status: 400 });
	}

	try {
		// A generation that cannot produce a loadout is still a successful
		// answer: the reason is the product's response, not an error, and the
		// page needs it to say something useful.
		return json(
			(await generateSmartLoadout(parsed.data, { fetch })) satisfies SmartGenerateResponse
		);
	} catch {
		// Only the catalog or a broken guard reaches here. Nothing about the
		// upstream is the visitor's to read.
		return json({ error: 'Smart Loadout is temporarily unavailable' }, { status: 503 });
	}
};
