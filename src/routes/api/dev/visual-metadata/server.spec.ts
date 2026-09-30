import { describe, expect, it, vi } from 'vitest';

/**
 * Curation must be impossible in a production build.
 *
 * The write path touches the repository, so "not linked in navigation" is not
 * a control — the handlers have to refuse. These run with `dev` forced false,
 * which is what a build looks like.
 */
vi.mock('$app/environment', () => ({
	dev: false,
	building: false,
	browser: false,
	version: 'test'
}));
vi.mock('$lib/server/services/catalog', () => ({ getBrowsableSkins: vi.fn() }));

const { GET, POST } = await import('./+server');
const { getBrowsableSkins } = await import('$lib/server/services/catalog');

function event(body?: unknown) {
	return {
		url: new URL('http://localhost/api/dev/visual-metadata'),
		fetch: globalThis.fetch,
		request: new Request('http://localhost/api/dev/visual-metadata', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		})
	} as unknown as Parameters<typeof GET>[0];
}

describe('outside development', () => {
	it('does not list the catalog', async () => {
		await expect(GET(event())).rejects.toMatchObject({ status: 404 });
		expect(getBrowsableSkins).not.toHaveBeenCalled();
	});

	it('offers no write surface at all', async () => {
		// Not a 400 for a bad record — a 404, before the body is even read.
		await expect(
			POST(
				event({
					key: 'ak-47::redline',
					weapon: 'AK-47',
					skinName: 'Redline',
					primaryColors: ['red'],
					secondaryColors: [],
					styles: []
				})
			)
		).rejects.toMatchObject({ status: 404 });
	});
});
