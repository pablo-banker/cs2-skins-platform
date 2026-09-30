/**
 * Editorial kits, resolved against the catalog.
 *
 * Reads our own static dataset and joins it to the cached skin index. **No
 * market data**: `/kits` must not cost a price request, and a kit definition
 * has no business knowing what anything costs.
 */
import kitsFile from '$lib/data/editorial-kits.json';
import { editorialKitsFileSchema } from '$lib/schemas/kit';
import { resolveVariant } from '$lib/features/skins/variant-selection';
import type { EditorialKit, ResolvedKit, ResolvedKitItem } from '$lib/types/kit';
import type { Skin } from '$lib/types/skin';
import type { Cs2CapRequestOptions } from '../providers/cs2cap/client';
import { getSkinBySlug } from './catalog';

let cachedKits: EditorialKit[] | undefined;

/**
 * The parsed dataset.
 *
 * Parsed once, and loudly: malformed editorial data is a content bug we want
 * to see in development, not a kit that silently disappears from the page.
 */
export function getEditorialKits(): EditorialKit[] {
	if (!cachedKits) {
		const parsed = editorialKitsFileSchema.safeParse(kitsFile);

		if (!parsed.success) {
			const where = parsed.error.issues
				.slice(0, 5)
				.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
				.join('; ');

			throw new Error(`editorial-kits.json is invalid — ${where}`);
		}

		cachedKits = parsed.data.kits;
	}

	return cachedKits;
}

export function getEditorialKitBySlug(slug: string): EditorialKit | undefined {
	return getEditorialKits().find((kit) => kit.slug === slug);
}

/** Raised when a kit names a skin or variant the catalog does not have. */
export class KitResolutionError extends Error {
	constructor(
		readonly kitSlug: string,
		message: string
	) {
		super(`Kit "${kitSlug}": ${message}`);
		this.name = 'KitResolutionError';
	}
}

/**
 * Joins a kit's references to real catalog skins.
 *
 * A preferred variant is editorial intent, so it is checked rather than
 * approximated: if a kit asks for a Field-Tested that does not exist, that is
 * broken content and it fails here instead of quietly showing a different
 * exterior — and later, pricing a different item.
 */
export async function resolveKit(
	kit: EditorialKit,
	options: Cs2CapRequestOptions = {}
): Promise<ResolvedKit> {
	const items: ResolvedKitItem[] = [];

	for (const item of kit.items) {
		const skin: Skin | undefined = await getSkinBySlug(item.skinSlug, options);

		if (!skin) {
			throw new KitResolutionError(kit.slug, `no catalog skin for "${item.skinSlug}"`);
		}

		const variant = resolveVariant(skin, item.variant ?? {});

		if (!variant) {
			throw new KitResolutionError(kit.slug, `"${item.skinSlug}" has no variants`);
		}

		// `resolveVariant` falls back by design; for editorial content an
		// unmet preference is an error, not a substitution.
		if (item.variant?.wear && variant.wear !== item.variant.wear) {
			throw new KitResolutionError(
				kit.slug,
				`"${item.skinSlug}" has no ${item.variant.wear} variant`
			);
		}

		if (item.variant?.phase && variant.phase !== item.variant.phase) {
			throw new KitResolutionError(
				kit.slug,
				`"${item.skinSlug}" has no ${item.variant.phase} variant`
			);
		}

		items.push({ skin, variant });
	}

	return { ...kit, items };
}

/** Every kit, in editorial order, resolved against the catalog. */
export async function getResolvedKits(options: Cs2CapRequestOptions = {}): Promise<ResolvedKit[]> {
	const kits = getEditorialKits();
	const resolved: ResolvedKit[] = [];

	for (const kit of kits) {
		resolved.push(await resolveKit(kit, options));
	}

	return resolved;
}

export async function getResolvedKitBySlug(
	slug: string,
	options: Cs2CapRequestOptions = {}
): Promise<ResolvedKit | undefined> {
	const kit = getEditorialKitBySlug(slug);

	return kit ? resolveKit(kit, options) : undefined;
}
