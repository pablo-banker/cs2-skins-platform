import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * Developer preview only. In a production build this route does not exist, so
 * the guard runs before anything renders on either the server or the client.
 */
export const load = () => {
	if (!dev) error(404, 'Not found');
};
