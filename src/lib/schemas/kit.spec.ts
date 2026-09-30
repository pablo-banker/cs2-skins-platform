import { describe, expect, it } from 'vitest';
import { editorialKitSchema, editorialKitsFileSchema, KIT_MAX_ITEMS, KIT_MIN_ITEMS } from './kit';

/**
 * Fictional kits. The production dataset gets its own suite below this one —
 * these fixtures exist to prove the schema rejects what a curator could
 * plausibly type into the JSON by hand, which the type system never sees.
 */
function kit(overrides: Record<string, unknown> = {}): unknown {
	return {
		slug: 'test-kit',
		name: 'Test Kit',
		description: 'A kit that exists only in this test file.',
		category: 'color',
		tags: ['red', 'black'],
		items: [
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
			{ skinSlug: 'awp-redline' },
			{ skinSlug: 'glock-18-candy-apple', variant: { wear: 'Factory New', edition: 'normal' } }
		],
		...overrides
	};
}

function items(count: number): unknown[] {
	return Array.from({ length: count }, (_, index) => ({ skinSlug: `skin-${index}` }));
}

describe('editorialKitSchema', () => {
	it('accepts a well-formed kit', () => {
		const parsed = editorialKitSchema.safeParse(kit());

		expect(parsed.success).toBe(true);
	});

	it('accepts both categories', () => {
		expect(editorialKitSchema.safeParse(kit({ category: 'color' })).success).toBe(true);
		expect(editorialKitSchema.safeParse(kit({ category: 'style' })).success).toBe(true);
	});

	it('accepts style tags as well as colour tags', () => {
		expect(
			editorialKitSchema.safeParse(kit({ category: 'style', tags: ['dark', 'minimal'] })).success
		).toBe(true);
	});

	it('rejects a missing name', () => {
		const parsed = editorialKitSchema.safeParse(kit({ name: undefined }));

		expect(parsed.success).toBe(false);
	});

	it('rejects an empty or whitespace-only name', () => {
		expect(editorialKitSchema.safeParse(kit({ name: '' })).success).toBe(false);
		expect(editorialKitSchema.safeParse(kit({ name: '   ' })).success).toBe(false);
	});

	it('rejects a missing description', () => {
		expect(editorialKitSchema.safeParse(kit({ description: undefined })).success).toBe(false);
	});

	it('rejects a slug that is not lowercase and hyphenated', () => {
		expect(editorialKitSchema.safeParse(kit({ slug: 'Test Kit' })).success).toBe(false);
		expect(editorialKitSchema.safeParse(kit({ slug: 'test_kit' })).success).toBe(false);
		expect(editorialKitSchema.safeParse(kit({ slug: '-test' })).success).toBe(false);
	});

	it('rejects a category outside the vocabulary', () => {
		expect(editorialKitSchema.safeParse(kit({ category: 'vibe' })).success).toBe(false);
	});

	it('rejects a tag outside the skin visual vocabulary', () => {
		// "crimson" is a fine kit *name* and not a vocabulary colour — a tag
		// invented per kit is exactly what the shared vocabulary prevents.
		expect(editorialKitSchema.safeParse(kit({ tags: ['crimson'] })).success).toBe(false);
	});

	it('rejects duplicate tags', () => {
		const parsed = editorialKitSchema.safeParse(kit({ tags: ['red', 'red'] }));

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe('Duplicate tag');
	});

	it('requires at least one tag and allows at most four', () => {
		expect(editorialKitSchema.safeParse(kit({ tags: [] })).success).toBe(false);
		expect(
			editorialKitSchema.safeParse(kit({ tags: ['red', 'black', 'white', 'gold'] })).success
		).toBe(true);
		expect(
			editorialKitSchema.safeParse(kit({ tags: ['red', 'black', 'white', 'gold', 'blue'] })).success
		).toBe(false);
	});

	it('rejects a kit with too few items', () => {
		expect(editorialKitSchema.safeParse(kit({ items: items(KIT_MIN_ITEMS - 1) })).success).toBe(
			false
		);
		expect(editorialKitSchema.safeParse(kit({ items: items(KIT_MIN_ITEMS) })).success).toBe(true);
	});

	it('rejects a kit with too many items', () => {
		expect(editorialKitSchema.safeParse(kit({ items: items(KIT_MAX_ITEMS) })).success).toBe(true);
		expect(editorialKitSchema.safeParse(kit({ items: items(KIT_MAX_ITEMS + 1) })).success).toBe(
			false
		);
	});

	it('rejects the same skin twice in one kit', () => {
		const parsed = editorialKitSchema.safeParse(
			kit({
				items: [
					{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } },
					{ skinSlug: 'ak-47-redline', variant: { wear: 'Minimal Wear' } },
					{ skinSlug: 'awp-redline' }
				]
			})
		);

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe('A kit cannot contain the same skin twice');
	});

	it('rejects an edition outside the known editions', () => {
		const parsed = editorialKitSchema.safeParse(
			kit({
				items: [
					{ skinSlug: 'ak-47-redline', variant: { edition: 'souvenir-stattrak' } },
					{ skinSlug: 'awp-redline' },
					{ skinSlug: 'glock-18-candy-apple' }
				]
			})
		);

		expect(parsed.success).toBe(false);
	});

	it('rejects unknown fields on a kit', () => {
		expect(editorialKitSchema.safeParse(kit({ price: 12000 })).success).toBe(false);
		expect(editorialKitSchema.safeParse(kit({ featured: true })).success).toBe(false);
	});

	it('rejects unknown fields on an item and on its variant', () => {
		expect(
			editorialKitSchema.safeParse(
				kit({ items: [{ skinSlug: 'a-b', itemId: 12632 }, ...items(2)] })
			).success
		).toBe(false);

		expect(
			editorialKitSchema.safeParse(
				kit({ items: [{ skinSlug: 'a-b', variant: { float: 0.2 } }, ...items(2)] })
			).success
		).toBe(false);
	});
});

describe('editorialKitsFileSchema', () => {
	it('accepts a file with kits', () => {
		expect(editorialKitsFileSchema.safeParse({ kits: [kit()] }).success).toBe(true);
	});

	it('keeps an explanatory $comment', () => {
		const parsed = editorialKitsFileSchema.safeParse({
			$comment: 'Curated by hand.',
			kits: [kit()]
		});

		expect(parsed.success).toBe(true);
	});

	it('rejects a duplicate kit slug', () => {
		const parsed = editorialKitsFileSchema.safeParse({
			kits: [kit(), kit({ name: 'Another Kit' })]
		});

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.message).toBe('Duplicate kit slug "test-kit"');
		expect(parsed.error?.issues[0]?.path).toEqual(['kits', 1, 'slug']);
	});

	it('rejects an empty file and unknown top-level fields', () => {
		expect(editorialKitsFileSchema.safeParse({ kits: [] }).success).toBe(false);
		expect(editorialKitsFileSchema.safeParse({ kits: [kit()], version: 2 }).success).toBe(false);
	});
});
