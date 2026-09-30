import { expect, test, type Page } from '@playwright/test';

/**
 * Explore against the stubbed catalog (see playwright.config.ts).
 *
 * The fixture holds 63 skins across eleven weapons — including everything the
 * editorial kits reference plus a knife and gloves for the builder — so
 * pagination, filtering and search all have
 * something real to act on without touching CS2Cap.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function summary(page: Page) {
	return page.locator('[aria-live="polite"]');
}

test.describe('explore on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('renders catalog results server-side', async ({ page }) => {
		const response = await page.goto('/explore');

		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: 'Explore skins' })).toBeVisible();
		await expect(summary(page)).toContainText('Showing 1–24 of 63 skins');
		await expect(page.getByRole('link', { name: /Redline/ }).first()).toBeVisible();
	});

	test('shows no price state on browse cards', async ({ page }) => {
		// Explore loads no prices, so it must not claim any are unavailable.
		await page.goto('/explore');

		await expect(page.getByText('Price unavailable')).toHaveCount(0);
		await expect(page.getByText('From', { exact: true })).toHaveCount(0);
	});

	test('searches from the URL and from the form', async ({ page }) => {
		await page.goto('/explore?q=asiimov');
		await expect(summary(page)).toContainText('2 skins for');

		await page.goto('/explore');
		await ready(page);
		await page.getByRole('searchbox', { name: 'Search skins' }).fill('vulcan');
		// Exact: the header's "Search skins" trigger also matches loosely.
		await page.getByRole('button', { name: 'Search', exact: true }).click();

		await expect(page).toHaveURL(/q=vulcan/);
		await expect(summary(page)).toContainText('1 skin for');
	});

	test('filters, shows a chip, and clears it again', async ({ page }) => {
		await page.goto('/explore?weapon=AK-47');
		await ready(page);

		await expect(summary(page)).toContainText('of 6 skins');

		const chip = page.getByRole('link', { name: /Remove Weapon filter AK-47/ });
		await expect(chip).toBeVisible();
		await chip.click();

		await expect(page).toHaveURL('/explore');
		await expect(summary(page)).toContainText('of 63 skins');
	});

	test('combines filters and offers a way out of an empty result', async ({ page }) => {
		await page.goto('/explore?weapon=AWP&rarity=Mil-Spec+Grade');
		await ready(page);

		await expect(page.getByRole('heading', { name: 'No skins found' })).toBeVisible();

		await page.getByRole('link', { name: 'Clear filters' }).click();
		await expect(page).toHaveURL('/explore');
	});

	test('narrows to StatTrak and Souvenir finishes', async ({ page }) => {
		await page.goto('/explore?stattrak=true');
		await expect(summary(page)).toContainText('of 1 skin');

		await page.goto('/explore?souvenir=true');
		await expect(summary(page)).toContainText('of 1 skin');
	});

	test('paginates while keeping the filters', async ({ page }) => {
		await page.goto('/explore');
		await ready(page);

		const pagination = page.getByRole('navigation', { name: 'Pagination' });
		await pagination.getByRole('link', { name: /Next/ }).click();

		await expect(page).toHaveURL(/page=2/);
		await expect(summary(page)).toContainText('Showing 25–48 of 63 skins');
		await expect(pagination.getByText('2')).toHaveAttribute('aria-current', 'page');
	});

	test('opens a skin from a result card', async ({ page }) => {
		await page.goto('/explore?q=vulcan');
		await ready(page);

		await page
			.getByRole('link', { name: /Vulcan/ })
			.first()
			.click();

		await expect(page).toHaveURL('/skins/ak-47-vulcan');
		await expect(page.getByRole('heading', { level: 1, name: 'Vulcan' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('404s an unknown skin instead of inventing one', async ({ page }) => {
		const response = await page.goto('/skins/not-a-real-skin');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	});
});

test.describe('explore on mobile', () => {
	test.use({ viewport: MOBILE });

	test('filters through the sheet, which closes on selection', async ({ page }) => {
		await page.goto('/explore');
		await ready(page);

		await page.getByRole('button', { name: /Filters/ }).click();

		const sheet = page.getByRole('dialog');
		await expect(sheet).toBeVisible();
		await sheet.getByRole('link', { name: /StatTrak only/ }).click();

		await expect(page).toHaveURL(/stattrak=true/);
		await expect(sheet).toBeHidden();
		await expect(summary(page)).toContainText('of 1 skin');
	});

	test('has no horizontal overflow', async ({ page }) => {
		await page.goto('/explore?weapon=AK-47');

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);

		expect(overflows).toBe(false);
	});
});
