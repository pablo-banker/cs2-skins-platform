/**
 * Operational configuration for the CS2Cap integration.
 *
 * Not secrets — but still server-only. Which upstream endpoints a deployment
 * is entitled to use is infrastructure, and the browser has no business
 * knowing it, so none of this is ever given a `PUBLIC_` prefix.
 */
import { env } from '$env/dynamic/private';

/**
 * Whether this deployment may use `POST /prices/batch`.
 *
 * Batch lookups are not available on every CS2Cap plan, and the plan is a
 * property of the key, not something the application can inspect. So it is
 * stated explicitly rather than discovered:
 *
 * - `false` (default) — multi-item pricing loads items individually, with
 *   bounded concurrency, reusing the existing per-item cache.
 * - `true` — multi-item pricing issues one batch request.
 *
 * Deliberately **no probing**. "Try batch, catch 403, fall back forever" turns
 * a misconfigured deployment into a silent performance regression that nobody
 * ever notices. If batch is switched on and upstream refuses, the failure
 * stays visible on the server while the page degrades calmly.
 */
export function batchPricesEnabled(): boolean {
	return env.CS2CAP_BATCH_PRICES_ENABLED?.trim().toLowerCase() === 'true';
}
