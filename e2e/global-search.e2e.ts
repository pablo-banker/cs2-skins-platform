import { expect, test, type Page } from '@playwright/test';

/**
 * Global search against the stubbed catalog (see playwright.config.ts).
 * No network, no key.
 */
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

async function searchFor(page: Page, query: string) {
	await page.getByPlaceholder('Search skins, e.g. Redline').fill(query);
	// Past the debounce, then wait for the results group.
	await expect(page.getByText('Skins', { exact: true })).toBeVisible({ timeout: 5000 });
}

test.describe('global search on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('opens from the header trigger and invites a search', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();

		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByPlaceholder('Search skins, e.g. Redline')).toBeFocused();
		await expect(page.getByText('Search by weapon or skin name.')).toBeVisible();
	});

	test('opens with the keyboard shortcut', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.keyboard.press('ControlOrMeta+k');

		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('finds a skin and opens it with the keyboard', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.keyboard.press('ControlOrMeta+k');
		await searchFor(page, 'redline');

		await expect(page.getByText('Redline').first()).toBeVisible();

		await page.keyboard.press('Enter');

		await expect(page).toHaveURL('/skins/ak-47-redline');
		await expect(page.getByRole('heading', { level: 1, name: 'Redline' })).toBeVisible();
	});

	test('opens a result by clicking it', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();
		await searchFor(page, 'asiimov');

		await page.getByRole('dialog').getByText('Asiimov').first().click();

		await expect(page).toHaveURL(/\/skins\/.+-asiimov/);
	});

	test('bridges into Explore through view all', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();
		await searchFor(page, 'redline');

		await page.getByText(/View all results/).click();

		await expect(page).toHaveURL('/explore?q=redline');
		await expect(page.locator('[aria-live="polite"]')).toContainText('for');
	});

	test('says so plainly when nothing matches', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();
		await page.getByPlaceholder('Search skins, e.g. Redline').fill('zzzznothing');

		await expect(page.getByText(/No skins found for/)).toBeVisible({ timeout: 5000 });
	});

	test('closes with Escape and returns focus to the trigger', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.keyboard.press('ControlOrMeta+k');
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.keyboard.press('Escape');

		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Search skins' })).toBeFocused();
	});

	test('remembers what was opened', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Search skins' }).click();
		await searchFor(page, 'redline');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/skins/ak-47-redline');

		await page.getByRole('button', { name: 'Search skins' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Recent')).toBeVisible();
		await expect(dialog.getByText('Redline')).toBeVisible();
	});
});

test.describe('global search on mobile', () => {
	test.use({ viewport: MOBILE });

	test('is directly reachable, not buried in the menu', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const trigger = page.getByRole('button', { name: 'Search skins' });
		await expect(trigger).toBeVisible();

		await trigger.click();
		await searchFor(page, 'redline');
		await page.getByRole('dialog').getByText('Redline').first().click();

		await expect(page).toHaveURL('/skins/ak-47-redline');
	});
});
