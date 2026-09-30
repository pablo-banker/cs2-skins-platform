/**
 * The sitemap.
 *
 * **Canonical product URLs only.** One entry per grouped skin and one per
 * editorial kit, plus the static surfaces — never a variant query, a filter
 * combination or a share payload. Those are views of a page, not pages, and
 * indexing them would multiply ~2,000 real URLs into a number nobody wants.
 *
 * Costs **nothing at the market API**: the catalog index is already cached and
 * kits are an editorial file. No prices, no providers, no history.
 */
import { getBrowsableSkins } from '$lib/server/services/catalog';
import { getEditorialKits } from '$lib/server/services/kits';
import type { RequestHandler } from './$types';

/**
 * The surfaces worth indexing.
 *
 * `/wishlist` is absent on purpose — it is local to one browser, so its
 * server-rendered content is the same empty frame for everybody. `/api/*` and
 * `/dev/*` are not pages.
 */
const STATIC_ROUTES = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/explore', changefreq: 'daily', priority: '0.9' },
	{ path: '/kits', changefreq: 'weekly', priority: '0.8' },
	{ path: '/build', changefreq: 'monthly', priority: '0.7' },
	{ path: '/smart-loadout', changefreq: 'monthly', priority: '0.7' },
	{ path: '/knife-gloves', changefreq: 'monthly', priority: '0.7' }
] as const;

/** XML-safe text. Slugs are `[a-z0-9-]`, but an origin is not ours to trust. */
function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function urlEntry(origin: string, path: string, changefreq: string, priority: string): string {
	return [
		'\t<url>',
		`\t\t<loc>${escapeXml(new URL(path, origin).href)}</loc>`,
		`\t\t<changefreq>${changefreq}</changefreq>`,
		`\t\t<priority>${priority}</priority>`,
		'\t</url>'
	].join('\n');
}

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const entries: string[] = STATIC_ROUTES.map((route) =>
		urlEntry(url.origin, route.path, route.changefreq, route.priority)
	);

	/**
	 * Kits are an editorial file with no upstream dependency, so they are
	 * listed even when the catalog is down.
	 */
	for (const kit of getEditorialKits()) {
		entries.push(urlEntry(url.origin, `/kits/${kit.slug}`, 'weekly', '0.6'));
	}

	try {
		for (const skin of await getBrowsableSkins({ fetch })) {
			// The product URL, never `?wear=` — a variant is a view of this page
			// and shares its canonical.
			entries.push(urlEntry(url.origin, `/skins/${skin.id}`, 'weekly', '0.6'));
		}
	} catch {
		// A catalog outage costs the skin entries, not the sitemap. Serving the
		// stable routes is better than serving nothing, and far better than
		// serving malformed XML.
	}

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		// The catalog index itself is cached for six hours; matching that keeps
		// a crawler from rebuilding this on every visit.
		'cache-control': 'public, max-age=3600'
	});

	return new Response(body);
};
