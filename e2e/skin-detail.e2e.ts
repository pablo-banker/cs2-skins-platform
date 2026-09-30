import { expect, test, type Page } from '@playwright/test';

/**
 * Skin details against the stubbed catalog and market (playwright.config.ts).
 * The fixture prices each variant from its item id, so switching variants must
 * visibly change the numbers.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function bestPrice(page: Page) {
	return page
		.locator('section')
		.filter({ hasText: 'Marketplace prices' })
		.locator('.font-mono')
		.first();
}

test.describe('skin details on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('arrives from Explore and renders server-side', async ({ page }) => {
		await page.goto('/explore?q=redline');
		await ready(page);

		await page
			.getByRole('link', { name: /Redline/ })
			.first()
			.click();

		await expect(page).toHaveURL('/skins/ak-47-redline');
		await expect(page.getByRole('heading', { level: 1, name: 'Redline' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('arrives from global search', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();
		await page.getByPlaceholder('Search skins, e.g. Redline').fill('redline');
		await expect(page.getByText('Skins', { exact: true })).toBeVisible({ timeout: 5000 });
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL('/skins/ak-47-redline');
	});

	test('shows the best price, its marketplace and a tracked offer link', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		const prices = page.getByRole('region', { name: 'Marketplace prices' });
		await expect(prices.getByText('Best price').first()).toBeVisible();
		await expect(prices.getByText('Skins.com').first()).toBeVisible();

		const offer = page.getByRole('link', { name: /View offer/ });
		await expect(offer).toHaveAttribute('href', /cs2c\.app\/r\/skinscom\//);
		await expect(offer).toHaveAttribute('target', '_blank');
	});

	test('lists one brand’s market modes as separate prices', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		const prices = page.getByRole('region', { name: 'Marketplace prices' });
		await expect(prices.getByText('CS.MONEY - Market')).toBeVisible();
		await expect(prices.getByText('CS.MONEY - Trade')).toBeVisible();
	});

	test('switching exterior updates the URL and the prices', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		const before = await bestPrice(page).innerText();

		await page
			.getByRole('group', { name: 'Exterior' })
			.getByRole('link', { name: 'Field-Tested' })
			.click();

		await expect(page).toHaveURL('/skins/ak-47-redline?wear=Field-Tested');
		await expect(bestPrice(page)).not.toHaveText(before);
	});

	test('switching edition keeps the exterior and reprices', async ({ page }) => {
		await page.goto('/skins/ak-47-redline?wear=Field-Tested');
		await ready(page);

		const before = await bestPrice(page).innerText();

		await page
			.getByRole('group', { name: 'Edition' })
			.getByRole('link', { name: 'StatTrak' })
			.click();

		await expect(page).toHaveURL(/edition=stattrak/);
		await expect(page).toHaveURL(/wear=Field-Tested/);
		await expect(bestPrice(page)).not.toHaveText(before);
	});

	test('a shared variant URL loads that variant directly', async ({ page }) => {
		await page.goto('/skins/ak-47-redline?wear=Field-Tested&edition=stattrak');
		await ready(page);

		const edition = page.getByRole('group', { name: 'Edition' });
		await expect(edition.getByRole('link', { name: 'StatTrak' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	test('offers 7D and 30D history without another request', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		const history = page.locator('section').filter({ hasText: 'Price history' }).first();
		await expect(history.getByText('30-day low')).toBeVisible();

		await history.getByRole('button', { name: '7D' }).click();

		await expect(history.getByText('7-day low')).toBeVisible();
		// Range switching is local: the URL does not move.
		await expect(page).toHaveURL('/skins/ak-47-redline');
	});

	test('shows catalog facts and no float UI', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		const info = page.getByRole('region', { name: 'Skin information' });
		// Exact: the label and its value both contain the word.
		await expect(info.getByText('Collection', { exact: true })).toBeVisible();
		await expect(info.getByText('Rarity', { exact: true })).toBeVisible();
		await expect(page.getByText(/Min float|Max float/)).toHaveCount(0);
	});

	test('404s an unknown skin', async ({ page }) => {
		const response = await page.goto('/skins/not-a-real-skin');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	});
});

test.describe('skin details on mobile', () => {
	test.use({ viewport: MOBILE });

	test('stacks without horizontal overflow', async ({ page }) => {
		await page.goto('/skins/ak-47-redline?wear=Field-Tested');
		await ready(page);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);

		expect(overflows).toBe(false);
		await expect(page.getByRole('heading', { level: 1, name: 'Redline' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});
});
