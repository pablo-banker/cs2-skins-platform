/**
 * Validation for the development curation workspace.
 *
 * Separate from the production dataset schema only in what it accepts as a
 * *request*; what it writes is exactly `skinVisualMetadataSchema`, so curation
 * cannot produce a record the application would refuse to load.
 */
import { z } from 'zod';
import { skinVisualMetadataSchema } from './visual-metadata';
import type { SkinVisualMetadata } from '$lib/types/visual-metadata';

export const curationQuerySchema = z.object({
	weapon: z.string().trim().max(60).optional(),
	status: z.enum(['all', 'curated', 'uncurated']).catch('all'),
	q: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(500).catch(100)
});

export type CurationQuery = z.infer<typeof curationQuerySchema>;

/** One save. The record must be valid production data, not a draft. */
export const curationSaveSchema = skinVisualMetadataSchema;

/** A catalog skin as the workspace renders it. */
export type CurationSkin = {
	key: string;
	weapon: string;
	skinName: string;
	fullName: string;
	imageUrl?: string;
	itemSubtype?: string;
	/** The existing classification, or null when nobody has looked yet. */
	metadata: SkinVisualMetadata | null;
};

export type CurationResponse = {
	skins: CurationSkin[];
	matched: number;
	catalogTotal: number;
	curatedTotal: number;
	weapons: string[];
};
