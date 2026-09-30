/**
 * The Knife + Gloves matcher's query state.
 *
 * ```text
 * /knife-gloves?skin=karambit-crimson-web&wear=Field-Tested
 * ```
 *
 * The source is **selection state, not identity**: `/knife-gloves` is the
 * canonical page, and every combination below is a view of it. Variant
 * parameters reuse the skin page's vocabulary rather than inventing a second
 * one, so a link from Skin Details carries over unchanged.
 */
import { z } from 'zod';
import { parseSkinSelection } from './skin-detail';
import type { SkinSelection } from './skin-detail';

/** The query parameter naming the source skin. */
export const KNIFE_GLOVES_SOURCE_PARAM = 'skin';

/**
 * A catalog slug, shaped.
 *
 * Not validated against the catalog here — that needs a lookup, and the service
 * is the authority. This only rejects what could never be a slug, so obvious
 * junk never reaches a catalog scan.
 */
const slugSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9-]+$/)
	.optional()
	.catch(undefined);

export type KnifeGlovesQuery = {
	/** Absent when nothing is selected yet. */
	slug?: string;
	selection: SkinSelection;
};

/**
 * Reads the matcher's query state.
 *
 * Total: an unreadable parameter becomes "unselected" rather than an error.
 * Someone editing a URL by hand should land on the picker, not a 400.
 */
export function parseKnifeGlovesQuery(params: URLSearchParams): KnifeGlovesQuery {
	return {
		slug: slugSchema.parse(params.get(KNIFE_GLOVES_SOURCE_PARAM) ?? undefined),
		selection: parseSkinSelection(params)
	};
}

/**
 * The matcher URL for a source and an optional exact variant.
 *
 * One builder for every link into this page — the Skin Details CTA, the picker
 * and the exterior selector all go through it, so they cannot disagree about
 * parameter names.
 */
export function knifeGlovesHref(slug: string, selection: SkinSelection = {}): string {
	const params = [`${KNIFE_GLOVES_SOURCE_PARAM}=${encodeURIComponent(slug)}`];

	if (selection.wear) params.push(`wear=${encodeURIComponent(selection.wear)}`);
	if (selection.edition && selection.edition !== 'normal') {
		params.push(`edition=${encodeURIComponent(selection.edition)}`);
	}
	if (selection.phase) params.push(`phase=${encodeURIComponent(selection.phase)}`);

	return `?${params.join('&')}`;
}
