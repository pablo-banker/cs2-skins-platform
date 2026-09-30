/**
 * Putting a loadout in a link, and getting it back out.
 *
 * Pure, and portable between the browser and the server — a shared link is
 * decoded during SSR so the first render is already right, and encoded in the
 * browser when someone presses Share.
 *
 * There is no share database and no share id. A link carries the loadout
 * itself, which means a link works forever without anything being stored, and
 * nobody has to reason about who owns a row.
 */
import { LOADOUT_SLOTS } from '$lib/config/loadout';
import { orderedSelections } from './selection';
import type { Loadout, LoadoutSelection } from '$lib/types/loadout';
import type { SkinEdition } from '$lib/schemas/skin-detail';

/** The query parameter a shared loadout travels in. */
export const SHARE_PARAM = 'loadout';

/**
 * The format marker.
 *
 * Present so a future format cannot be read as this one. A payload whose
 * prefix we do not recognise is rejected outright rather than parsed
 * hopefully — silently reinterpreting someone's link is how a loadout turns
 * into a different loadout.
 */
export const SHARE_VERSION = 'v1';

const PREFIX = `${SHARE_VERSION}.`;

/**
 * Hard ceiling on an encoded payload.
 *
 * A full 37-slot loadout measures well under this (see `docs/BUILDER.md`), so
 * the limit exists to reject something pathological rather than to constrain
 * the product. Applied on the way in *and* on the way out: a link we would not
 * accept is a link we must not produce.
 */
export const MAX_SHARE_PAYLOAD = 8192;

export type ShareDecodeError = 'malformed' | 'unsupported-version' | 'too-large';

export type ShareDecodeResult =
	{ ok: true; selections: LoadoutSelection[] } | { ok: false; error: ShareDecodeError };

/** UTF-8 bytes to base64url, without `Buffer` so this runs in a browser too. */
function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	// Chunked: spreading a few thousand bytes into `fromCharCode` is fine, but
	// the limit is an engine detail and this costs nothing.
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): Uint8Array {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);

	return bytes;
}

/**
 * One selection as a tuple: `[slotId, skinSlug, wear, edition, phase]`.
 *
 * A tuple rather than an object because the field names would otherwise be
 * repeated 37 times for no benefit — the shape is fixed and this file owns
 * both ends of it. Trailing empty values are dropped, so the common case
 * (a slot, a skin and an exterior) costs three strings.
 */
type SelectionTuple = string[];

function toTuple(selection: LoadoutSelection): SelectionTuple {
	const tuple = [
		selection.slotId,
		selection.skinSlug,
		selection.variant.wear ?? '',
		selection.variant.edition ?? '',
		selection.variant.phase ?? ''
	];

	while (tuple.length > 2 && tuple[tuple.length - 1] === '') tuple.pop();

	return tuple;
}

function fromTuple(tuple: unknown): LoadoutSelection | undefined {
	if (!Array.isArray(tuple) || tuple.length < 2 || tuple.length > 5) return undefined;
	if (!tuple.every((value) => typeof value === 'string')) return undefined;

	const [slotId, skinSlug, wear, edition, phase] = tuple as string[];
	if (!slotId || !skinSlug) return undefined;

	return {
		slotId,
		skinSlug,
		variant: {
			...(wear ? { wear } : {}),
			// Not validated against the edition vocabulary here: the codec's job
			// is to return what the link said, and the server decides whether it
			// describes anything real.
			...(edition ? { edition: edition as SkinEdition } : {}),
			...(phase ? { phase } : {})
		}
	};
}

/**
 * Encodes a loadout for a URL.
 *
 * **Deterministic.** Selections are canonicalised into registry order first, so
 * the same set of choices always produces the same link however they were
 * clicked — two people who built the same loadout get the same URL, and a link
 * does not churn because someone re-picked a slot.
 *
 * Returns nothing when the result would exceed the limit, so a caller can say
 * so instead of handing out a URL that will not survive a round trip.
 */
export function encodeLoadout(loadout: Loadout): string | undefined {
	const tuples = orderedSelections(loadout).map(toTuple);
	const json = JSON.stringify(tuples);
	const payload = PREFIX + toBase64Url(new TextEncoder().encode(json));

	return payload.length > MAX_SHARE_PAYLOAD ? undefined : payload;
}

/**
 * Reads a payload back.
 *
 * Total: every failure is a returned error, never a throw, because this runs
 * against a query parameter a stranger controls and a malformed link must not
 * take a page down. Nothing is evaluated — `JSON.parse` on a decoded byte
 * string, and a shape check on what comes out.
 *
 * What it does **not** do is decide whether the selections describe anything
 * real. That needs the catalog, and the server is the authority.
 */
export function decodeLoadout(payload: string): ShareDecodeResult {
	if (typeof payload !== 'string' || payload.length === 0) {
		return { ok: false, error: 'malformed' };
	}

	if (payload.length > MAX_SHARE_PAYLOAD) return { ok: false, error: 'too-large' };

	if (!payload.startsWith(PREFIX)) {
		// A recognisable `vN.` from another build is a version we cannot read;
		// anything else is not one of our links at all.
		return { ok: false, error: /^v\d+\./.test(payload) ? 'unsupported-version' : 'malformed' };
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload.slice(PREFIX.length))));
	} catch {
		return { ok: false, error: 'malformed' };
	}

	if (!Array.isArray(parsed) || parsed.length > LOADOUT_SLOTS.length) {
		return { ok: false, error: 'malformed' };
	}

	const selections: LoadoutSelection[] = [];

	for (const tuple of parsed) {
		const selection = fromTuple(tuple);
		if (!selection) return { ok: false, error: 'malformed' };

		selections.push(selection);
	}

	return { ok: true, selections };
}

/**
 * The absolute link to share.
 *
 * Built from the origin the page is actually running on, so the same code
 * produces a working link in development, in preview and in production without
 * knowing which it is.
 */
export function shareUrl(loadout: Loadout, origin: string): string | undefined {
	const payload = encodeLoadout(loadout);
	if (!payload) return undefined;

	const url = new URL('/build', origin);
	url.searchParams.set(SHARE_PARAM, payload);

	return url.href;
}
