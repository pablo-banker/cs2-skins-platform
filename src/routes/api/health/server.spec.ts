import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

/**
 * Anything the health endpoint reached would be something that can take a
 * healthy process down with it. These mocks exist to prove it reaches none of
 * them.
 */
vi.mock('$lib/server/services/catalog', () => ({
	getBrowsableSkins: vi.fn(),
	getSkinBySlug: vi.fn(),
	browseSkins: vi.fn()
}));
vi.mock('$lib/server/services/market', () => ({
	getSkinPrices: vi.fn(),
	getManySkinPrices: vi.fn(),
	getMarketProviders: vi.fn(),
	getSkinPriceHistory: vi.fn()
}));

const catalog = await import('$lib/server/services/catalog');
const market = await import('$lib/server/services/market');

const call = () => GET({} as unknown as Parameters<typeof GET>[0]);

describe('liveness', () => {
	it('says the process is up', async () => {
		const response = await call();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	it('is never cached', async () => {
		// A cached health check is not a health check.
		expect((await call()).headers.get('cache-control')).toContain('no-store');
	});

	it('answers identically every time', async () => {
		// Synchronous and stateless: nothing it returns can drift between
		// calls, which is what makes it safe to poll every few seconds.
		const bodies = [await (await call()).text(), await (await call()).text()];

		expect(new Set(bodies).size).toBe(1);
	});
});

describe('what it must never touch', () => {
	it('asks the catalog nothing', async () => {
		await call();

		expect(catalog.getBrowsableSkins).not.toHaveBeenCalled();
		expect(catalog.getSkinBySlug).not.toHaveBeenCalled();
	});

	it('asks the market nothing', async () => {
		// The failure this prevents: a CS2Cap outage making the platform
		// restart a process that could still serve editorial and local
		// features perfectly well.
		await call();

		expect(market.getSkinPrices).not.toHaveBeenCalled();
		expect(market.getManySkinPrices).not.toHaveBeenCalled();
		expect(market.getMarketProviders).not.toHaveBeenCalled();
		expect(market.getSkinPriceHistory).not.toHaveBeenCalled();
	});

	it('imports no service at all — the guarantee, not the behaviour', () => {
		const source = readFileSync('src/routes/api/health/+server.ts', 'utf8');

		expect(source).not.toMatch(/services\/|providers\/|\$env/);
	});
});

describe('what it must never say', () => {
	it('reveals nothing about the deployment or the provider', async () => {
		const body = await (await call()).text();

		// No version, no uptime, no key state, no provider name: a health
		// endpoint is unauthenticated and reachable by anyone.
		expect(body).toBe('{"status":"ok"}');
	});
});
