import type { RouteId } from '$app/types';

/**
 * A route that needs no parameters.
 *
 * Navigation entries point at whole sections, never at a single record, so
 * parameterised routes like `/skins/[slug]` are excluded — they cannot be
 * resolved without data the nav config does not have.
 */
export type StaticRouteId = Exclude<RouteId, `${string}[${string}`>;

/**
 * Site-level configuration: the product name, its one-line description and the
 * global navigation.
 *
 * Single source of truth on purpose — the name appears in the header, the
 * footer and every page title, and the navigation is rendered twice (desktop
 * and mobile). Both are defined here exactly once so renaming or reordering is
 * one edit, not a search.
 */

/**
 * **Temporary working label.** The real brand name has not been chosen yet, so
 * nothing should be designed around this string: no wordmark, no logo, no
 * asset. Changing it here changes it everywhere.
 */
export const site = {
	name: 'CS2 Skins',
	description: 'Compare CS2 skin prices across marketplaces and build the inventory you want.'
} as const;

/**
 * The routes the global navigation points at.
 *
 * Narrowed rather than typed as the whole `StaticRouteId` union, for a mundane
 * reason: `resolve()` distributes over its route union, and passing it a union
 * as wide as "every static route in the app" stops type-checking once the app
 * has enough routes. A four-member union resolves cleanly.
 *
 * `Extract` keeps the guarantee that made the wide type attractive — rename or
 * delete one of these routes and it drops out of this union, so the entry
 * below fails the build rather than shipping a dead link.
 */
export type NavRouteId = Extract<StaticRouteId, '/explore' | '/kits' | '/build' | '/smart-loadout'>;

export type NavItem = {
	label: string;
	href: NavRouteId;
	/** One line describing the area, reused by the route placeholders. */
	description: string;
};

/**
 * Global navigation — the product's three pillars plus Smart Loadout
 * (docs/CONCEPT.md § 4, § 11). Home is reached through the brand link, so it
 * is deliberately not an entry here.
 *
 * Accounts and community are not in the MVP and must not appear. The wishlist
 * is reached through the heart icon in the header rather than a fifth label —
 * see `AppHeader`.
 */
export const mainNav: NavItem[] = [
	{
		label: 'Explore',
		href: '/explore',
		description: 'Browse and compare CS2 skins.'
	},
	{
		label: 'Kits',
		href: '/kits',
		description: 'Ready-made skin sets grouped by colour, budget and style.'
	},
	{
		label: 'Build',
		href: '/build',
		description: 'Assemble a full inventory and see what it costs.'
	},
	{
		label: 'Smart Loadout',
		href: '/smart-loadout',
		description: 'Set a budget and preferences, and get inventory suggestions.'
	}
];

/**
 * The navigation entry for a route, so a page can reuse its own label and
 * description instead of restating them.
 *
 * Throws rather than returning `undefined`: the argument is a real route id, so
 * a miss means the nav config and the route tree have drifted apart.
 */
export function navItem(href: NavRouteId): NavItem {
	const item = mainNav.find((entry) => entry.href === href);

	if (!item) {
		throw new Error(`No navigation entry is configured for "${href}"`);
	}

	return item;
}

/**
 * Whether a nav entry owns the current route.
 *
 * A section stays highlighted for everything beneath it, so `/skins/ak-47` is
 * still "Explore" to the visitor even though the URL changed. Matching on the
 * segment boundary keeps `/build` from claiming a future `/builder`.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Builds a document title. Without a page name, the site name stands alone —
 * "CS2 Skins — CS2 Skins" helps nobody.
 */
export function pageTitle(page?: string): string {
	return page ? `${page} — ${site.name}` : site.name;
}
