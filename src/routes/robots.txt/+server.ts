/**
 * `robots.txt`, served by the app rather than from `static/`.
 *
 * It needs the request origin to point at the sitemap, and a file on disk
 * cannot know what host it is being served from.
 */
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	/**
	 * Crawl the product; skip the plumbing.
	 *
	 * `/api/` is data for this application's own browser code, and `/dev/` is
	 * development tooling that 404s in production anyway — listing them costs
	 * nothing and saves a crawler the requests. Everything a visitor can
	 * usefully land on stays open.
	 */
	const body = [
		'User-agent: *',
		'Disallow: /api/',
		'Disallow: /dev/',
		'',
		`Sitemap: ${new URL('/sitemap.xml', url.origin).href}`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			// Stable content, and a crawler re-reads it often enough.
			'cache-control': 'public, max-age=3600'
		}
	});
};
