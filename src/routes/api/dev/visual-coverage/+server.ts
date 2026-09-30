/**
 * Where visual curation actually stands, in development only.
 *
 * The number product decisions rest on: overall catalog coverage, and — the
 * one that matters for Smart Loadout — how many curated candidates each core
 * slot has. A core slot with two curated skins would make every generated
 * loadout look the same.
 *
 * Catalog only. No price request.
 */
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { getBrowsableSkins } from '$lib/server/services/catalog';
import { getAllVisualMetadata } from '$lib/server/services/visual-metadata';
import { smartCoreCoverage, visualMetadataCoverage } from '$lib/features/visual/coverage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	if (!dev) error(404, 'Not found');

	const catalog = await getBrowsableSkins({ fetch });
	const records = getAllVisualMetadata();

	return json({
		coverage: visualMetadataCoverage(catalog, records),
		smartCore: smartCoreCoverage(catalog, records).map((entry) => ({
			id: entry.entry.id,
			label: entry.entry.label,
			optional: entry.entry.optional,
			curated: entry.curated,
			bySlot: entry.bySlot
		}))
	});
};
