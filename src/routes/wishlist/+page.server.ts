/**
 * The wishlist page shell.
 *
 * There is deliberately almost nothing here. The authoritative list lives in
 * `localStorage`, which the server cannot see and must not pretend to — so the
 * server renders the frame, the title and a stable restoring surface, and the
 * browser fills it in.
 *
 * No user identity exists anywhere in this product, so there is nothing to
 * look up.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});
