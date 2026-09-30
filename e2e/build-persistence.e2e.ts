import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Persistence and sharing, against the production build.
 *
 * The properties worth protecting: a reload does not lose a loadout, a shared
 * link carries exact variants and no prices, and opening someone else's link
 * does not quietly overwrite what the visitor already had.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const STORAGE_KEY = 'cs2-skins:builder:v1';

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function summary(page: Page) {
	return page.getByRole('region', { name: 'Your loadout' });
}

/** Waits for restoration to settle, so assertions never race it. */
async function settled(page: Page) {
	await expect(summary(page).getByText(/\d+ \/ \d+ slots filled/)).toBeVisible();
}

async function fillSlot(page: Page, slot: string, skin: string, exterior?: string) {
	await page
		.getByRole('button', {
			name: new RegExp(`(Choose skin for the ${slot} slot|Change ${slot} skin)`)
		})
		.click();

	const dialog = page.getByRole('dialog', { name: `Choose a ${slot} skin` });
	await expect(dialog).toBeVisible();

	await dialog
		.getByRole('button', { name: new RegExp(skin) })
		.first()
		.click();
	if (exterior) await dialog.getByRole('button', { name: exterior, exact: true }).click();

	await dialog.getByRole('button', { name: /Add to loadout|Replace skin/ }).click();
	await expect(dialog).toBeHidden();
}

async function readStorage(page: Page): Promise<string | null> {
	return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
}

/** Copies the share link, reading it from the clipboard stub. */
async function copyShareLink(page: Page): Promise<string> {
	await page.evaluate(() => {
		const holder = window as unknown as { __copied?: string };
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					holder.__copied = text;
				}
			}
		});
	});

	await summary(page)
		.getByRole('button', { name: /Copy a link/ })
		.click();
	await expect(summary(page).getByText('Link copied to your clipboard.')).toBeVisible();

	return page.evaluate(() => (window as unknown as { __copied: string }).__copied);
}

test.describe('local persistence', () => {
	test.use({ viewport: DESKTOP });

	test('brings a loadout back after a reload', async ({ page }) => {
		await page.goto('/build');
		await settled(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await fillSlot(page, 'AWP', 'Asiimov', 'Field-Tested');
		await expect(summary(page).getByText(/^2 \/ \d+ slots filled$/)).toBeVisible();

		await page.reload();
		await settled(page);

		await expect(page.getByRole('link', { name: 'Redline' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Asiimov' })).toBeVisible();
		await expect(summary(page).getByText(/^2 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('restores the exact exterior, not a default', async ({ page }) => {
		await page.goto('/build');
		await settled(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Battle-Scarred');
		await page.reload();
		await settled(page);

		const slot = page.getByRole('link', { name: 'Redline' }).locator('xpath=ancestor::div[1]');
		await expect(slot.getByText('Battle-Scarred')).toBeVisible();
	});

	test('stores canonical identity and no market data', async ({ page }) => {
		await page.goto('/build');
		await settled(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();

		const raw = await readStorage(page);

		expect(raw).toContain('"version":1');
		expect(raw).toContain('ak-47-redline');
		expect(raw).not.toMatch(/price|currency|provider|itemId|marketHash/i);
	});

	test('forgets the loadout once it is cleared', async ({ page }) => {
		await page.goto('/build');
		await settled(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await expect.poll(() => readStorage(page)).not.toBeNull();

		await summary(page).getByRole('button', { name: 'Clear loadout' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Clear loadout' }).click();

		await expect.poll(() => readStorage(page)).toBeNull();

		await page.reload();
		await settled(page);

		await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('calculates no prices on restore', async ({ page }) => {
		await page.goto('/build');
		await settled(page);
		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();

		let priceCalls = 0;
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/build/prices') priceCalls++;
		});

		await page.reload();
		await settled(page);

		await expect(summary(page).getByText('Prices not calculated yet.')).toBeVisible();
		expect(priceCalls).toBe(0);
	});

	test('survives corrupt storage', async ({ page }) => {
		await page.goto('/build');
		await settled(page);
		await page.evaluate((key) => localStorage.setItem(key, '{not json'), STORAGE_KEY);

		await page.reload();
		await settled(page);

		await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: 'Build your loadout' })).toBeVisible();
	});
});

test.describe('sharing', () => {
	test.use({ viewport: DESKTOP });

	async function openIsolated(context: BrowserContext, url: string): Promise<Page> {
		// A second, storage-free context: the link has to work for someone who
		// has never used the site.
		const fresh = await context.browser()!.newContext({ viewport: DESKTOP });
		const page = await fresh.newPage();
		await page.goto(url);

		return page;
	}

	test('carries the exact loadout to a browser that has never seen it', async ({
		page,
		context
	}) => {
		await page.goto('/build');
		await settled(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await fillSlot(page, 'AWP', 'Asiimov', 'Minimal Wear');
		await fillSlot(page, 'Knife', 'Doppler');

		const link = await copyShareLink(page);
		expect(link).toContain('/build?loadout=v1.');
		expect(link).not.toMatch(/price|R\$|provider/i);

		let priceCalls = 0;
		const shared = await openIsolated(context, link);
		shared.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/build/prices') priceCalls++;
		});
		await ready(shared);

		await expect(summary(shared).getByText(/^3 \/ \d+ slots filled$/)).toBeVisible();
		await expect(shared.getByRole('link', { name: 'Redline' })).toBeVisible();
		await expect(shared.getByRole('link', { name: 'Asiimov' })).toBeVisible();
		await expect(shared.getByRole('link', { name: 'Doppler' })).toBeVisible();

		// Exact variants, not representative ones.
		await expect(shared.getByText('Minimal Wear').first()).toBeVisible();
		await expect(summary(shared).getByText('Prices not calculated yet.')).toBeVisible();
		await expect(summary(shared).getByText('Shared loadout')).toBeVisible();
		expect(priceCalls).toBe(0);

		await shared.close();
	});

	test('offers nothing to share while the builder is empty', async ({ page }) => {
		await page.goto('/build');
		await settled(page);

		await expect(summary(page).getByRole('button', { name: /Copy a link/ })).toHaveCount(0);
	});

	test('leaves the address bar alone when sharing', async ({ page }) => {
		await page.goto('/build');
		await settled(page);
		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');

		await copyShareLink(page);

		expect(new URL(page.url()).search).toBe('');
	});

	test('keeps the canonical URL plain for a shared loadout', async ({ page, context }) => {
		await page.goto('/build');
		await settled(page);
		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');

		const shared = await openIsolated(context, await copyShareLink(page));

		await expect(shared.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/build$/);
		await expect(shared).toHaveTitle(/Build a CS2 Loadout/);

		await shared.close();
	});
});

test.describe('shared versus local', () => {
	test.use({ viewport: DESKTOP });

	test('shows the shared loadout without touching the visitor’s own save', async ({
		page,
		context
	}) => {
		// Loadout A, saved on this device.
		await page.goto('/build');
		await settled(page);
		await fillSlot(page, 'Knife', 'Doppler');
		const savedA = await readStorage(page);
		expect(savedA).toContain('karambit-doppler');

		// Loadout B, built elsewhere and shared.
		const other = await context.browser()!.newContext({ viewport: DESKTOP });
		const builderPage = await other.newPage();
		await builderPage.goto('/build');
		await settled(builderPage);
		await fillSlot(builderPage, 'AK-47', 'Redline', 'Field-Tested');
		const link = await copyShareLink(builderPage);
		await builderPage.close();

		// The visitor opens B in their own browser.
		await page.goto(link);
		await ready(page);

		await expect(summary(page).getByText('Shared loadout')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Redline' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Doppler' })).toHaveCount(0);

		// A is exactly where it was.
		expect(await readStorage(page)).toBe(savedA);
	});

	test('adopts the shared loadout on the first edit, and drops the stale link', async ({
		page,
		context
	}) => {
		const other = await context.browser()!.newContext({ viewport: DESKTOP });
		const builderPage = await other.newPage();
		await builderPage.goto('/build');
		await settled(builderPage);
		await fillSlot(builderPage, 'AK-47', 'Redline', 'Field-Tested');
		await fillSlot(builderPage, 'AWP', 'Asiimov', 'Field-Tested');
		const link = await copyShareLink(builderPage);
		await builderPage.close();

		await page.goto(link);
		await ready(page);
		expect(new URL(page.url()).searchParams.has('loadout')).toBe(true);

		await page.getByRole('button', { name: /Remove Asiimov/ }).click();

		// The URL no longer describes what is on screen, so it goes.
		await expect.poll(() => new URL(page.url()).searchParams.has('loadout')).toBe(false);
		expect(new URL(page.url()).pathname).toBe('/build');
		await expect(summary(page).getByText('Shared loadout')).toHaveCount(0);

		// And the edited loadout is now this visitor's, saved.
		await expect.poll(() => readStorage(page)).toContain('ak-47-redline');
		expect(await readStorage(page)).not.toContain('awp-asiimov');
	});
});

test.describe('a shared link that no longer resolves', () => {
	test.use({ viewport: DESKTOP });

	/** `v1.` plus base64url of the given tuples. */
	function payload(tuples: string[][]): string {
		return `v1.${Buffer.from(JSON.stringify(tuples), 'utf8').toString('base64url')}`;
	}

	test('restores what still exists and says what did not', async ({ page }) => {
		await page.goto(
			`/build?loadout=${payload([
				['ak-47', 'ak-47-redline', 'Field-Tested'],
				['awp', 'awp-a-skin-that-was-removed'],
				['gloves', 'ak-47-redline']
			])}`
		);
		await ready(page);

		await expect(page.getByRole('link', { name: 'Redline' })).toBeVisible();
		await expect(
			summary(page).getByText(/2 saved selections are no longer available/)
		).toBeVisible();
		await expect(summary(page).getByText(/^1 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('never substitutes a different exterior', async ({ page }) => {
		// The AK is stocked in Field-Tested here, not Factory New.
		await page.goto(`/build?loadout=${payload([['ak-47', 'ak-47-redline', 'Not A Real Wear']])}`);
		await ready(page);

		await expect(page.getByRole('link', { name: 'Redline' })).toHaveCount(0);
		await expect(page.getByText('This shared loadout could not be loaded.')).toBeVisible();
	});

	test('degrades calmly for a malformed, unsupported or oversized link', async ({ page }) => {
		for (const bad of [
			'not-a-payload',
			'v9.' + Buffer.from('[["ak-47","ak-47-redline"]]').toString('base64url'),
			'v1.' + 'A'.repeat(9000)
		]) {
			const response = await page.goto(`/build?loadout=${encodeURIComponent(bad)}`);

			expect(response?.status(), bad.slice(0, 12)).toBe(200);
			await expect(page.getByText('This shared loadout could not be loaded.')).toBeVisible();
			await settled(page);
			await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
		}
	});
});

test.describe('persistence on mobile', () => {
	test.use({ viewport: MOBILE });

	test('shares and restores without horizontal overflow', async ({ page }) => {
		await page.goto('/build');
		await settled(page);
		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');

		await copyShareLink(page);
		await expect(summary(page).getByText('Link copied to your clipboard.')).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);

		expect(overflows).toBe(false);
	});
});
