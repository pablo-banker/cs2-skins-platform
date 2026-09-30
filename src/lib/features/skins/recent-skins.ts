/**
 * Recently opened skins, remembered in this browser only.
 *
 * A convenience, not data: no account, no sync, no server. `localStorage` can
 * be unavailable (private mode, blocked site data) or hold something another
 * version wrote, so every read is defensive and a failure simply means no
 * recents rather than a broken dialog.
 */
import type { SkinSearchItem } from './search-result';

const STORAGE_KEY = 'cs2skins.recent-skins';

/** Short enough to stay a shortcut rather than a second history page. */
export const RECENT_SKINS_LIMIT = 5;

/** The subset worth persisting — enough to render a row and navigate. */
export type RecentSkin = Pick<SkinSearchItem, 'slug' | 'weapon' | 'name' | 'fullName' | 'imageUrl'>;

function isRecentSkin(value: unknown): value is RecentSkin {
	if (typeof value !== 'object' || value === null) return false;

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.slug === 'string' &&
		candidate.slug.length > 0 &&
		typeof candidate.weapon === 'string' &&
		typeof candidate.name === 'string' &&
		typeof candidate.fullName === 'string'
	);
}

/**
 * The stored list, or an empty one.
 *
 * Returns empty during SSR — there is no browser storage on the server, and a
 * personal convenience has no business in a server-rendered page anyway.
 */
export function readRecentSkins(): RecentSkin[] {
	if (typeof localStorage === 'undefined') return [];

	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(parsed)) return [];

		return parsed.filter(isRecentSkin).slice(0, RECENT_SKINS_LIMIT);
	} catch {
		// Corrupt or unreadable storage is not worth a thrown error.
		return [];
	}
}

/**
 * Records a skin as recently opened and returns the new list.
 *
 * Deduplicated by slug — the canonical route identity — and moved to the
 * front, so opening something again promotes it rather than repeating it.
 */
export function rememberRecentSkin(skin: RecentSkin): RecentSkin[] {
	const entry: RecentSkin = {
		slug: skin.slug,
		weapon: skin.weapon,
		name: skin.name,
		fullName: skin.fullName,
		imageUrl: skin.imageUrl
	};

	const next = [entry, ...readRecentSkins().filter((item) => item.slug !== entry.slug)].slice(
		0,
		RECENT_SKINS_LIMIT
	);

	if (typeof localStorage === 'undefined') return next;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Storage full or blocked: the list still works for this session.
	}

	return next;
}
