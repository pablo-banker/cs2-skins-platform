import { defineConfig, devices } from '@playwright/test';

/**
 * Browsers are not installed by this config. Run `pnpm exec playwright install`
 * once per machine (and in CI) before `pnpm test:e2e`.
 *
 * The suite runs against the production build with CS2Cap replaced by a local
 * stub (`e2e/mock-cs2cap.mjs`): end-to-end runs must not depend on a third
 * party being reachable, and CI must never need a real API key.
 */
const MOCK_PORT = 4180;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'html' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-cs2cap.mjs',
			port: MOCK_PORT,
			reuseExistingServer: !process.env.CI
		},
		{
			// The real production server, not `vite preview`. Security headers,
			// CSP, the adapter's own routing and the development-route guards
			// are all things only the deployed artefact can actually prove.
			command: 'pnpm run build && pnpm start',
			port: 4173,
			reuseExistingServer: !process.env.CI,
			env: {
				PORT: '4173',
				HOST: '127.0.0.1',
				ORIGIN: 'http://localhost:4173',
				CS2CAP_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
				// The stub ignores authentication; this only satisfies the
				// integration's "is it configured" check. It doubles as the
				// sentinel the bundle audit greps for.
				CS2CAP_API_KEY: 'e2e-stub-key'
			}
		}
	]
});
