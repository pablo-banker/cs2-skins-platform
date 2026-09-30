/**
 * Validation for the editorial kit dataset.
 *
 * Hand-written product data with no API contract behind it, so it is parsed as
 * strictly as an external payload. What this cannot check is whether a
 * referenced skin or variant actually exists — that needs the catalog, and is
 * the kit service's job.
 */
import { z } from 'zod';
import { KIT_CATEGORIES } from '$lib/types/kit';
import { SKIN_COLORS, SKIN_STYLES } from '$lib/types/visual-metadata';
import { SKIN_EDITIONS } from '$lib/schemas/skin-detail';

/** Enough skins to read as a set, few enough to stay curated. */
export const KIT_MIN_ITEMS = 3;
export const KIT_MAX_ITEMS = 8;

const kitTagSchema = z.enum([...SKIN_COLORS, ...SKIN_STYLES]);

const slug = z
	.string()
	.trim()
	.min(1)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase and hyphenated');

const kitItemSchema = z
	.object({
		skinSlug: slug,
		variant: z
			.object({
				wear: z.string().trim().min(1).optional(),
				edition: z.enum(SKIN_EDITIONS).optional(),
				phase: z.string().trim().min(1).optional()
			})
			.strict()
			.optional()
	})
	.strict();

export const editorialKitSchema = z
	.object({
		slug,
		name: z.string().trim().min(1).max(40),
		description: z.string().trim().min(1).max(200),
		category: z.enum(KIT_CATEGORIES),
		tags: z
			.array(kitTagSchema)
			.min(1)
			.max(4)
			.refine((tags) => new Set(tags).size === tags.length, 'Duplicate tag'),
		items: z
			.array(kitItemSchema)
			.min(KIT_MIN_ITEMS)
			.max(KIT_MAX_ITEMS)
			.refine(
				(items) => new Set(items.map((item) => item.skinSlug)).size === items.length,
				// Silently deduplicating would mean the file says one thing and
				// the product shows another.
				'A kit cannot contain the same skin twice'
			)
	})
	.strict();

/**
 * The dataset file.
 *
 * Array order is editorial order: the first kit is shown first, and the first
 * items of a kit are the ones its cover image uses.
 */
export const editorialKitsFileSchema = z
	.object({
		$comment: z.string().optional(),
		kits: z.array(editorialKitSchema).min(1)
	})
	.strict()
	.superRefine((file, ctx) => {
		const seen = new Set<string>();

		for (const [index, kit] of file.kits.entries()) {
			if (seen.has(kit.slug)) {
				ctx.addIssue({
					code: 'custom',
					message: `Duplicate kit slug "${kit.slug}"`,
					path: ['kits', index, 'slug']
				});
			}

			seen.add(kit.slug);
		}
	});
