/**
 * The curation workspace's data, in development only.
 *
 * `GET` lists catalog skins with whatever classification they already have, so
 * a curator can see coverage and work through what is missing. `POST` writes a
 * reviewed record back to `src/lib/data/skin-visual-metadata.json`.
 *
 * **Both return 404 outside development.** A production build has no write
 * surface here at all — the handlers refuse before reading the request, and a
 * test proves it. Curation is something a person does at a workstation with
 * the repository in front of them, never something a deployment can do.
 *
 * Catalog only: no price request, no provider directory, no history.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { getBrowsableSkins } from '$lib/server/services/catalog';
import { visualMetadataKey } from '$lib/server/services/visual-metadata';
import {
	curationQuerySchema,
	curationSaveSchema,
	type CurationSkin
} from '$lib/schemas/visual-curation';
import { skinVisualMetadataFileSchema } from '$lib/schemas/visual-metadata';
import type { SkinVisualMetadata } from '$lib/types/visual-metadata';
import type { RequestHandler } from './$types';

const DATA_FILE = 'src/lib/data/skin-visual-metadata.json';

/** Reads the dataset from disk rather than the import, so saves are visible. */
async function readDataset(): Promise<SkinVisualMetadata[]> {
	const parsed = skinVisualMetadataFileSchema.safeParse(
		JSON.parse(await readFile(DATA_FILE, 'utf8'))
	);

	if (!parsed.success) throw new Error('skin-visual-metadata.json is invalid');

	return parsed.data.records;
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	if (!dev) error(404, 'Not found');

	const query = curationQuerySchema.parse({
		weapon: url.searchParams.get('weapon') ?? undefined,
		status: url.searchParams.get('status') ?? undefined,
		q: url.searchParams.get('q') ?? undefined,
		limit: url.searchParams.get('limit') ?? undefined
	});

	const [catalog, records] = await Promise.all([getBrowsableSkins({ fetch }), readDataset()]);
	const curated = new Map(records.map((record) => [record.key, record]));

	const needle = query.q?.trim().toLowerCase();

	const skins: CurationSkin[] = catalog
		.filter((skin) => !query.weapon || skin.weapon === query.weapon)
		.filter((skin) => !needle || skin.fullName.toLowerCase().includes(needle))
		.map((skin) => ({
			key: visualMetadataKey(skin.weapon, skin.name),
			weapon: skin.weapon,
			skinName: skin.name,
			fullName: skin.fullName,
			imageUrl: skin.imageUrl,
			itemSubtype: skin.itemSubtype,
			metadata: curated.get(visualMetadataKey(skin.weapon, skin.name)) ?? null
		}))
		.filter((skin) =>
			query.status === 'curated'
				? skin.metadata !== null
				: query.status === 'uncurated'
					? skin.metadata === null
					: true
		)
		.sort((a, b) => a.fullName.localeCompare(b.fullName));

	return json({
		skins: skins.slice(0, query.limit),
		matched: skins.length,
		catalogTotal: catalog.length,
		curatedTotal: records.length,
		weapons: [...new Set(catalog.map((skin) => skin.weapon))].sort((a, b) => a.localeCompare(b))
	});
};

export const POST: RequestHandler = async ({ request }) => {
	if (!dev) error(404, 'Not found');

	const parsed = curationSaveSchema.safeParse(await request.json());

	// The same validation production data goes through. Curation must not be
	// able to write a record the application would then refuse to load.
	if (!parsed.success) {
		return json({ error: 'Invalid record', issues: parsed.error.issues }, { status: 400 });
	}

	const record = parsed.data;
	const records = await readDataset();
	const existing = records.findIndex((entry) => entry.key === record.key);

	// Editing replaces in place. A second record under the same key would make
	// the dataset disagree with itself, which the loader refuses outright.
	if (existing >= 0) records[existing] = record;
	else records.push(record);

	records.sort((a, b) => a.key.localeCompare(b.key));

	const file = JSON.parse(await readFile(DATA_FILE, 'utf8'));
	await writeFile(DATA_FILE, `${JSON.stringify({ ...file, records }, null, '\t')}\n`, 'utf8');

	return json({ saved: record.key, curatedTotal: records.length });
};
