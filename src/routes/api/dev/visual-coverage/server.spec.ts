import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	dev: false,
	building: false,
	browser: false,
	version: 'test'
}));
vi.mock('$lib/server/services/catalog', () => ({ getBrowsableSkins: vi.fn() }));

const { GET } = await import('./+server');
const { getBrowsableSkins } = await import('$lib/server/services/catalog');

describe('the coverage report outside development', () => {
	it('is not available', async () => {
		const event = {
			url: new URL('http://localhost/api/dev/visual-coverage'),
			fetch: globalThis.fetch
		} as unknown as Parameters<typeof GET>[0];

		await expect(GET(event)).rejects.toMatchObject({ status: 404 });
		expect(getBrowsableSkins).not.toHaveBeenCalled();
	});
});
