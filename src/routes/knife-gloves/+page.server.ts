/**
 * The Knife + Gloves matcher.
 *
 * Server-rendered, with the source in the query. That makes a pairing
 * shareable, makes the back button work, and keeps the whole data path on the
 * server — there is no matcher endpoint because nothing in the browser needs
 * one.
 *
 * The picker dataset ships on every load. It is ~56 curated options with a
 * slug, a name and an image, which is small enough to search locally and far
 * cheaper than an endpoint that exists to filter fifty-six records.
 */
import { parseKnifeGlovesQuery } from '$lib/schemas/knife-gloves';
import {
	getKnifeGloveSourceOptions,
	getKnifeGlovesResult
} from '$lib/server/services/knife-gloves';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import type { KnifeGloveSourceOption, KnifeGlovesResult } from '$lib/types/knife-gloves';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const { slug, selection } = parseKnifeGlovesQuery(url.searchParams);

	try {
		const [options, result] = await Promise.all([
			getKnifeGloveSourceOptions({ fetch }),
			getKnifeGlovesResult(slug, selection, { fetch })
		]);

		return { options, result, catalogFailed: false };
	} catch (cause) {
		// Without the catalog there is nothing to pick from. Still not a route
		// error: the page says so and stays up, unlike a bad `?skin=`, which it
		// recovers from with the picker intact.
		if (cause instanceof CS2CapError) {
			const options: KnifeGloveSourceOption[] = [];
			const result: KnifeGlovesResult = { state: 'none' };

			return { options, result, catalogFailed: true };
		}

		throw cause;
	}
};
