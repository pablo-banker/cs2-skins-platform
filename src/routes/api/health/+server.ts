/**
 * Liveness.
 *
 * Answers one question: is this process up and serving HTTP? Nothing else.
 *
 * **It never touches CS2Cap, the catalog, prices or providers**, and that is
 * the whole design. A health check that depends on an upstream turns a
 * third-party outage into a restart loop — the platform kills a process that
 * was perfectly capable of serving the editorial, local and cached parts of
 * the product. Degrading honestly is the application's job; staying alive
 * while it does is this endpoint's.
 *
 * There is deliberately no readiness endpoint. The catalog loads lazily and
 * warms in the background, so "not warm yet" is a slower first response, not
 * an unhealthy process.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json(
		{ status: 'ok' },
		{
			// Never cached, by anything. A cached health check is not a health
			// check.
			headers: { 'cache-control': 'no-store' }
		}
	);
