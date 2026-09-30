import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * A developer tool, not a product page: curation happens at a workstation with
 * the repository in front of you, so it simply does not exist in a build.
 */
export const load: PageLoad = async () => {
	if (!dev) error(404, 'Not found');

	return {};
};
