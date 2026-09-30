import { expect, test, type Page } from '@playwright/test';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 780 };

const sections = [
	{ label: 'Explore', path: '/explore' },
	{ label: 'Kits', path: '/kits' },
	{ label: 'Build', path: '/build' },
	{ label: 'Smart Loadout', path: '/smart-loadout' }
];

/** Waits for hydration so a click is not dropped before the handler exists. */
async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

test.describe('desktop shell', () => {
	test.use({ viewport: DESKTOP });

	test('renders server-side with the dark theme applied', async ({ page }) => {
		const response = await page.goto('/');

		expect(response?.status()).toBe(200);
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();
	});

	test('navigates through every section from the header', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const nav = page.getByRole('navigation', { name: 'Main' });

		for (const section of sections) {
			await nav.getByRole('link', { name: section.label, exact: true }).click();

			await expect(page).toHaveURL(section.path);
			await expect(page.getByRole('heading', { level: 1, name: section.label })).toBeVisible();

			// The section the visitor is in is announced, not just coloured.
			await expect(nav.getByRole('link', { name: section.label, exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
		}
	});

	test('returns home through the brand link', async ({ page }) => {
		await page.goto('/explore');
		await ready(page);

		await page.getByRole('banner').getByRole('link', { name: 'CS2 Skins' }).click();

		await expect(page).toHaveURL('/');
	});

	test('shows a calm 404 that leads back home', async ({ page }) => {
		const response = await page.goto('/this-route-does-not-exist');
		await ready(page);

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

		await page.getByRole('link', { name: 'Back to home' }).click();
		await expect(page).toHaveURL('/');
	});
});

test.describe('mobile shell', () => {
	test.use({ viewport: MOBILE });

	test('navigates through the menu sheet, which closes on selection', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		// The desktop nav is not the navigation on offer here.
		await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();

		const trigger = page.getByRole('button', { name: 'Open menu' });
		await expect(trigger).toBeVisible();
		await trigger.click();

		const sheet = page.getByRole('dialog');
		await expect(sheet).toBeVisible();

		await sheet.getByRole('link', { name: 'Kits', exact: true }).click();

		await expect(page).toHaveURL('/kits');
		await expect(page.getByRole('heading', { level: 1, name: 'Kits' })).toBeVisible();
		await expect(sheet).toBeHidden();
	});

	test('closes the menu with Escape', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('button', { name: 'Open menu' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.keyboard.press('Escape');

		await expect(page.getByRole('dialog')).toBeHidden();
	});

	test('has no horizontal overflow', async ({ page }) => {
		await page.goto('/explore');

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);

		expect(overflows).toBe(false);
	});
});
