/**
 * Server-only HTTP client for the CS2Cap API.
 *
 * Responsibilities: base URL, auth header, query building, timeout, and
 * turning any failure into a `CS2CapError` the rest of the app can branch on.
 * Response parsing is delegated to the calling endpoint module, which owns the
 * schema for its payload.
 *
 * This module reads `CS2CAP_API_KEY` and must never be imported by browser
 * code. It lives under `$lib/server/**`, which SvelteKit refuses to bundle
 * into the client.
 */
import { env } from '$env/dynamic/private';
import type { z } from 'zod';
import { cs2capErrorSchema } from './schemas';

const CS2CAP_PRODUCTION_URL = 'https://api.cs2c.app/v1';

/**
 * Where CS2Cap lives.
 *
 * Overridable through `CS2CAP_BASE_URL` so end-to-end tests can point the
 * whole integration at a local stub — CI must never need a real key, and a
 * test suite that depends on a third party being up is a test suite that fails
 * for reasons that are not about us.
 */
export function cs2capBaseUrl(): string {
	return env.CS2CAP_BASE_URL?.trim() || CS2CAP_PRODUCTION_URL;
}

/** Upstream is a network hop on a user-facing path; it does not get to hang. */
export const CS2CAP_TIMEOUT_MS = 10_000;

/**
 * Timeout for bulk catalog reads.
 *
 * A full-catalog request is tens of megabytes and takes seconds by nature, so
 * the interactive timeout would abort a perfectly healthy response. It is
 * still bounded — a hung connection must not hold a request open forever.
 */
export const CS2CAP_BULK_TIMEOUT_MS = 60_000;

/** Product-facing prices are requested in BRL; CS2Cap does the conversion. */
export const CS2CAP_DEFAULT_CURRENCY = 'BRL';

/**
 * What went wrong, in terms a caller can act on.
 *
 * - `config` — no API key configured. Ours to fix, not the user's.
 * - `auth` — key rejected or revoked.
 * - `forbidden` — key valid, plan does not include this endpoint or window.
 * - `not_found` — upstream has no such resource.
 * - `rate_limit` — per-minute or monthly quota exhausted; see `retryAfterSeconds`.
 * - `unavailable` — upstream down, timed out, or unreachable. Transient.
 * - `invalid_response` — 200 that did not match the schema. Never trust it.
 * - `upstream` — anything else.
 */
export type CS2CapErrorKind =
	| 'config'
	| 'auth'
	| 'forbidden'
	| 'not_found'
	| 'rate_limit'
	| 'unavailable'
	| 'invalid_response'
	| 'upstream';

export class CS2CapError extends Error {
	readonly kind: CS2CapErrorKind;
	/** HTTP status, when the failure came from a response. */
	readonly status?: number;
	/** CS2Cap's machine-readable `code`, when present. */
	readonly code?: string;
	/** Seconds to wait, from `Retry-After` on a 429. */
	readonly retryAfterSeconds?: number;

	constructor(
		kind: CS2CapErrorKind,
		message: string,
		options: { status?: number; code?: string; retryAfterSeconds?: number; cause?: unknown } = {}
	) {
		super(message, { cause: options.cause });
		this.name = 'CS2CapError';
		this.kind = kind;
		this.status = options.status;
		this.code = options.code;
		this.retryAfterSeconds = options.retryAfterSeconds;
	}

	/** True for failures worth retrying with backoff. */
	get retryable(): boolean {
		return this.kind === 'unavailable' || this.kind === 'rate_limit';
	}
}

/** A query value; arrays are repeated as `?k=a&k=b`, nullish values are dropped. */
type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export type Cs2CapRequestOptions = {
	/**
	 * Fetch implementation. Defaults to the global one; SvelteKit `load`
	 * functions can pass their own, and tests pass a stub.
	 */
	fetch?: typeof globalThis.fetch;
	/** Overrides the default timeout. Bulk catalog reads need a longer one. */
	timeoutMs?: number;
};

function buildUrl(path: string, query: Record<string, QueryValue> = {}): URL {
	const url = new URL(`${cs2capBaseUrl()}${path}`);

	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;

		if (Array.isArray(value)) {
			for (const entry of value) url.searchParams.append(key, String(entry));
		} else {
			url.searchParams.set(key, String(value));
		}
	}

	return url;
}

function readApiKey(): string {
	const key = env.CS2CAP_API_KEY?.trim();

	if (!key) {
		throw new CS2CapError(
			'config',
			'CS2CAP_API_KEY is not configured. Set it in .env (see .env.example).'
		);
	}

	return key;
}

function kindForStatus(status: number): CS2CapErrorKind {
	if (status === 401) return 'auth';
	if (status === 403) return 'forbidden';
	if (status === 404) return 'not_found';
	if (status === 429) return 'rate_limit';
	if (status === 503 || status >= 500) return 'unavailable';
	return 'upstream';
}

/**
 * Reads CS2Cap's `{ code, detail }` envelope without letting a malformed body
 * become a second failure.
 */
async function readErrorEnvelope(response: Response): Promise<{ code?: string; detail?: string }> {
	try {
		const parsed = cs2capErrorSchema.safeParse(await response.json());
		if (!parsed.success) return {};

		const { code, detail } = parsed.data;
		return { code, detail: typeof detail === 'string' ? detail : undefined };
	} catch {
		return {};
	}
}

function parseRetryAfter(response: Response): number | undefined {
	const header = response.headers.get('retry-after');
	if (!header) return undefined;

	const seconds = Number(header);
	return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Performs one authenticated CS2Cap request and validates the response.
 *
 * Errors carry the upstream status and code but never the request headers, the
 * URL's credentials or the key itself — a `CS2CapError` is safe to log.
 */
export async function requestCs2Cap<TSchema extends z.ZodType>(
	path: string,
	config: {
		schema: TSchema;
		query?: Record<string, QueryValue>;
		/**
		 * JSON request body. Its presence makes the request a `POST` — the only
		 * CS2Cap endpoints we call this way are the batch lookups.
		 */
		body?: unknown;
	},
	options: Cs2CapRequestOptions = {}
): Promise<z.infer<TSchema>> {
	const apiKey = readApiKey();
	const url = buildUrl(path, config.query);
	const doFetch = options.fetch ?? globalThis.fetch;
	const timeoutMs = options.timeoutMs ?? CS2CAP_TIMEOUT_MS;
	const hasBody = config.body !== undefined;

	let response: Response;

	try {
		response = await doFetch(url, {
			method: hasBody ? 'POST' : 'GET',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: 'application/json',
				...(hasBody ? { 'Content-Type': 'application/json' } : {})
			},
			body: hasBody ? JSON.stringify(config.body) : undefined,
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (cause) {
		const timedOut = cause instanceof Error && cause.name === 'TimeoutError';

		throw new CS2CapError(
			'unavailable',
			timedOut
				? `CS2Cap did not respond within ${timeoutMs}ms (${path}).`
				: `Could not reach CS2Cap (${path}).`,
			{ cause }
		);
	}

	if (!response.ok) {
		const { code, detail } = await readErrorEnvelope(response);

		throw new CS2CapError(
			kindForStatus(response.status),
			`CS2Cap ${path} failed with ${response.status}${detail ? `: ${detail}` : ''}`,
			{ status: response.status, code, retryAfterSeconds: parseRetryAfter(response) }
		);
	}

	let payload: unknown;

	try {
		payload = await response.json();
	} catch (cause) {
		throw new CS2CapError('invalid_response', `CS2Cap ${path} returned a non-JSON body.`, {
			status: response.status,
			cause
		});
	}

	const parsed = config.schema.safeParse(payload);

	if (!parsed.success) {
		// Report where the shape broke, not what came back — the payload is not
		// ours to spill into a log line.
		const where = parsed.error.issues
			.slice(0, 3)
			.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
			.join('; ');

		throw new CS2CapError(
			'invalid_response',
			`CS2Cap ${path} returned an unexpected shape — ${where}`,
			{ status: response.status, cause: parsed.error }
		);
	}

	return parsed.data;
}
