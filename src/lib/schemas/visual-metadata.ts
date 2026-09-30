/**
 * Validation for the curated visual metadata files.
 *
 * This data is hand-written, which makes it the least trustworthy data in the
 * project: no API contract protects it, only review. A typo'd colour, a
 * duplicated key or a record that drifted from its own identity would fail
 * silently and quietly break discovery. So it is parsed exactly as strictly as
 * an external payload.
 *
 * The vocabulary comes from `$lib/types/visual-metadata` — these schemas add
 * rules, never new values.
 */
import { z } from 'zod';
import {
	SKIN_COLORS,
	SKIN_STYLES,
	type SkinColor,
	type SkinStyle
} from '$lib/types/visual-metadata';

export const skinColorSchema = z.enum(SKIN_COLORS);
export const skinStyleSchema = z.enum(SKIN_STYLES);

/** Rejects a list that names the same value twice. */
function uniqueList<T extends SkinColor | SkinStyle>(schema: z.ZodType<T>, label: string) {
	return z.array(schema).refine((values) => new Set(values).size === values.length, {
		message: `Duplicate ${label} in the same list`
	});
}

/**
 * Canonical product-level key: `weapon::skin-name`, lowercase.
 *
 * Kept permissive about the characters a CS2 name can contain (`-`, `'`, `.`,
 * `★`, digits) and strict about structure: exactly two non-empty halves, no
 * uppercase, no leading or trailing whitespace.
 */
export const visualMetadataKeySchema = z
	.string()
	.min(3)
	.regex(/^[^\s:][^:]*::[^:]*[^\s:]$/, 'Key must look like "weapon::skin name"')
	.refine((key) => key === key.toLowerCase(), 'Key must be lowercase')
	.refine((key) => key === key.trim(), 'Key must not have surrounding whitespace');

const nonEmptyName = z.string().trim().min(1, 'Must not be empty');

export const skinVisualMetadataSchema = z
	.object({
		key: visualMetadataKeySchema,
		weapon: nonEmptyName,
		skinName: nonEmptyName,
		primaryColors: uniqueList(skinColorSchema, 'primary colour').default([]),
		secondaryColors: uniqueList(skinColorSchema, 'secondary colour').default([]),
		styles: uniqueList(skinStyleSchema, 'style').default([])
	})
	.strict()
	.refine(
		(record) => !record.primaryColors.some((color) => record.secondaryColors.includes(color)),
		{
			message: 'A colour cannot be both primary and secondary',
			path: ['secondaryColors']
		}
	)
	.refine((record) => record.primaryColors.length > 0 || record.styles.length > 0, {
		// A record carrying only secondary colours classifies nothing a visitor
		// could search for. If it is worth curating, it has a primary colour or
		// a style.
		message: 'A record needs at least one primary colour or one style',
		path: ['primaryColors']
	});

/**
 * The dataset file.
 *
 * `$comment` is allowed through so the file can explain itself to whoever
 * opens it next; nothing reads it.
 */
export const skinVisualMetadataFileSchema = z
	.object({
		$comment: z.string().optional(),
		records: z.array(skinVisualMetadataSchema)
	})
	.superRefine((file, ctx) => {
		// Duplicates must fail loudly and by name. Silently keeping the first or
		// the last would mean the dataset says one thing and the product does
		// another.
		const seen = new Set<string>();

		for (const [index, record] of file.records.entries()) {
			if (seen.has(record.key)) {
				ctx.addIssue({
					code: 'custom',
					message: `Duplicate visual metadata key "${record.key}"`,
					path: ['records', index, 'key']
				});
			}

			seen.add(record.key);
		}
	});

const taxonomyEntries = <T extends string>(schema: z.ZodType<T>) =>
	z.array(z.object({ id: schema, label: z.string().trim().min(1) }).strict());

/**
 * The taxonomy file must cover the code vocabulary exactly: every value once,
 * nothing extra. Two vocabularies that drift apart is the failure mode this
 * prevents.
 */
export const visualTaxonomyFileSchema = z
	.object({
		$comment: z.string().optional(),
		colors: taxonomyEntries(skinColorSchema),
		styles: taxonomyEntries(skinStyleSchema)
	})
	.strict()
	.superRefine((file, ctx) => {
		const check = <T extends string>(
			entries: { id: T }[],
			vocabulary: readonly T[],
			path: string
		) => {
			const ids = entries.map((entry) => entry.id);
			const missing = vocabulary.filter((value) => !ids.includes(value));

			if (missing.length > 0) {
				ctx.addIssue({
					code: 'custom',
					message: `Taxonomy is missing: ${missing.join(', ')}`,
					path: [path]
				});
			}

			if (new Set(ids).size !== ids.length) {
				ctx.addIssue({ code: 'custom', message: `Duplicate entries in ${path}`, path: [path] });
			}
		};

		check(file.colors, SKIN_COLORS, 'colors');
		check(file.styles, SKIN_STYLES, 'styles');
	});
