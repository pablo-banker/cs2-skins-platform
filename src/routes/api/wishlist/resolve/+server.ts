/**
 * Current catalog data and prices for a saved wishlist.
 *
 * The browser holds canonical identity — a route slug and an exact variant —
 * and nothing about how a skin looks or what it costs today. This fills both
 * in without shipping the catalog to the client.
 *
 * It takes **identities only**. The add-time price snapshot and the saved
 * timestamp stay in the browser: the server has no use for them, and a payload
 * that carried them would invite it to start trusting numbers a client wrote.
 *
 * Unlike the builder's resolve, this one does price — automatically, in one
 * multi-item request. Seeing current prices is the entire point of opening the
 * wishlist, so making someone press a button first would be asking them to
 * confirm the thing they just asked for.
 */
import { json } from '@sveltejs/kit';
import { wishlistResolveRequestSchema } from '$lib/schemas/wishlist';
import { resolveWishlist } from '$lib/server/services/wishlist';
import type { WishlistResolution } from '$lib/types/wishlist';
import type { RequestHandler } from './$types';

export type WishlistResolveResponse = WishlistResolution;

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const parsed = wishlistResolveRequestSchema.safeParse(body);

	// A payload that is not even shaped like saved identities is a client
	// error. A payload of identities that no longer exist is not — those come
	// back listed as rejected, with a 200.
	if (!parsed.success) return json({ error: 'Invalid wishlist' }, { status: 400 });

	try {
		return json(
			(await resolveWishlist(parsed.data.items, { fetch })) satisfies WishlistResolveResponse
		);
	} catch {
		// Only the catalog itself can fail here — pricing is caught inside the
		// service. Nothing about the upstream reaches the visitor.
		return json({ error: 'Your wishlist could not be loaded' }, { status: 503 });
	}
};
