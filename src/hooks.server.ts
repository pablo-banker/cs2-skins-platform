/**
 * Server lifecycle: warmup, security headers and error handling.
 *
 * Three things that have to happen for every request or once for the process,
 * and belong to the deployment rather than to any feature.
 */
import { building, dev } from '$app/environment';
import { getBrowsableSkins } from '$lib/server/services/catalog';
import { CS2CapError } from '$lib/server/providers/cs2cap/client';
import type { Handle, HandleServerError } from '@sveltejs/kit';

/**
 * Headers every response carries.
 *
 * Deliberately short. The Content Security Policy is configured in
 * `vite.config.ts` so SvelteKit can hash its own inline script and style;
 * these are the ones it does not manage.
 *
 * No HSTS: TLS terminates at the hosting proxy, and emitting
 * `Strict-Transport-Security` from behind it — before the production domain
 * and certificate behaviour are confirmed — risks pinning a host into HTTPS it
 * cannot yet serve. That belongs at the edge. See `docs/DEPLOYMENT.md`.
 */
const SECURITY_HEADERS: Record<string, string> = {
	// The one header with no downside: stop browsers guessing a content type.
	'x-content-type-options': 'nosniff',
	// Send the full URL within our own origin and only the origin outward, so
	// a marketplace we link to learns we sent the visitor but not which skin.
	'referrer-policy': 'strict-origin-when-cross-origin',
	// Nothing here uses a camera, a microphone or a location. Saying so costs
	// nothing and removes the capability from any embedded content.
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
};

/**
 * Builds the catalog index once, shortly after the process starts.
 *
 * The measurement that justifies it: a cold process takes ~3.9s to answer its
 * first catalog-backed request and ~4ms afterwards. That first request is
 * somebody's first impression, and it is entirely avoidable — the work is the
 * same either way, it just happens before anyone is waiting.
 *
 * Deliberately **not awaited and not blocking**. The process listens
 * immediately, `/api/health` answers immediately, and a request that arrives
 * mid-warm simply joins the in-flight request the catalog service already
 * deduplicates. A failure is logged and changes nothing: the next request
 * loads the catalog lazily, exactly as it did before this existed.
 *
 * Skipped during build and prerender, where there is no process to warm, and
 * during development, where an immediate 20 MB upstream fetch on every restart
 * is a poor trade for a saved second.
 */
function warmCatalog(): void {
	if (building || dev) return;

	const startedAt = Date.now();

	// Not awaited on purpose; the process must not wait to start listening.
	void getBrowsableSkins()
		.then((skins) => {
			log({
				event: 'catalog.warm',
				status: 'ok',
				count: skins.length,
				durationMs: Date.now() - startedAt
			});
		})
		.catch((cause: unknown) => {
			// Lazy loading still works. This is information, not an incident.
			log({
				event: 'catalog.warm',
				status: 'failed',
				code: cause instanceof CS2CapError ? cause.kind : 'unknown',
				durationMs: Date.now() - startedAt
			});
		});
}

/**
 * One line of structured JSON per event.
 *
 * The platform's own log collection is the destination; there is no logging
 * vendor and no analytics. **Never** an API key, an `Authorization` header, a
 * request body, a share payload or anything from a visitor's device — a
 * wishlist and a loadout live in one browser and have no business in a server
 * log.
 */
function log(fields: Record<string, unknown>): void {
	console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

warmCatalog();

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(header, value);
	}

	return response;
};

/**
 * What a visitor sees when something throws, and what we record.
 *
 * The returned shape reaches the browser, so it carries a generic message and
 * nothing else — never a stack, a provider URL, a Zod issue or a filesystem
 * path. The log line beside it carries the diagnosis.
 *
 * Expected upstream failures are already handled where they happen: a price
 * outage degrades a section, a bad slug is a 404. Anything arriving here is
 * genuinely unexpected.
 */
export const handleServerError: HandleServerError = ({ error, event, status, message }) => {
	// SvelteKit's own 404s and `error()` throws arrive here too; they are
	// routing outcomes, not faults, and need no log line.
	if (status !== 500) return { message };

	log({
		event: 'request.error',
		route: event.route.id ?? event.url.pathname,
		status,
		// The kind, not the text: a CS2Cap message can name a path or a query.
		code: error instanceof CS2CapError ? `cs2cap:${error.kind}` : 'unhandled',
		// Safe to log, never to return.
		detail: error instanceof Error ? error.message : String(error)
	});

	return { message: 'Something went wrong on our side. Try again in a moment.' };
};
