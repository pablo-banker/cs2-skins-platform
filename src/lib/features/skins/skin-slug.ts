/**
 * Slugs for the product-level skin route.
 *
 * A slug is a readable URL label. Identity is the catalog's — `itemId` for a
 * variant, weapon + finish for the grouped skin — and the slug is resolved
 * against the catalog index rather than being parsed back into a name.
 *
 * Weapon + finish is **not** unique. Measured against the live catalog, one
 * weapon pair collides (`Desert Eagle | Sunset Storm 壱` and `弐`, whose
 * distinguishing characters are not URL-safe) and 42 collide catalog-wide. So
 * slugs are assigned by the index, which appends a counter to the second and
 * later entries of a collision in a deterministic order.
 */
import type { Skin } from '$lib/types/skin';

/** The readable part: lowercase, ASCII, hyphenated. Lossy by design. */
export function toSkinSlugBase(weapon: string, name: string): string {
	return `${weapon} ${name}`
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Assigns a unique slug to every skin.
 *
 * Skins are ordered deterministically first, so a collision always resolves
 * the same way across processes and restarts — a URL that worked yesterday
 * still points at the same skin today.
 */
export function assignSkinSlugs(skins: readonly Skin[]): Map<string, Skin> {
	const ordered = [...skins].sort(
		(a, b) =>
			a.weapon.localeCompare(b.weapon) ||
			a.name.localeCompare(b.name) ||
			(a.variants[0]?.itemId ?? 0) - (b.variants[0]?.itemId ?? 0)
	);

	const bySlug = new Map<string, Skin>();
	const seen = new Map<string, number>();

	for (const skin of ordered) {
		const base = toSkinSlugBase(skin.weapon, skin.name) || `skin-${skin.variants[0]?.itemId}`;
		const previous = seen.get(base) ?? 0;
		const slug = previous === 0 ? base : `${base}-${previous + 1}`;

		seen.set(base, previous + 1);
		bySlug.set(slug, { ...skin, id: slug });
	}

	return bySlug;
}
