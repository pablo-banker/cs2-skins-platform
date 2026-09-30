import { expect, test, type Page } from '@playwright/test';

/**
 * The loadout builder against the stubbed catalog and market.
 *
 * The property worth protecting here is the request discipline: browsing the
 * catalog costs nothing, and market traffic starts only when the visitor asks
 * for prices. Several tests count requests for exactly that reason.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

/** Counts calls to the builder's pricing endpoint. */
function watchPricing(page: Page): () => number {
	let calls = 0;

	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/api/build/prices') calls++;
	});

	return () => calls;
}

function summary(page: Page) {
	return page.getByRole('region', { name: 'Your loadout' });
}

/**
 * Opens a slot's picker, chooses a skin by name, and confirms.
 *
 * An empty slot opens with "Choose skin"; a filled one with "Change", so this
 * accepts either and works for both adding and replacing.
 */
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

test.describe('the builder on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('renders the slot registry server-side', async ({ page }) => {
		const response = await page.goto('/build');

		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: 'Build your loadout' })).toBeVisible();

		for (const section of ['Equipment', 'Pistols', 'SMGs', 'Rifles', 'Snipers', 'Heavy']) {
			await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
		}

		await expect(
			page.getByRole('button', { name: /Choose skin for the AK-47 slot/ })
		).toBeVisible();
	});

	test('does not ship the catalog to the browser', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		// The page knows its slots and nothing else; skins arrive per slot.
		const html = await page.content();
		expect(html).not.toContain('Asiimov');
		expect(html).not.toContain('Redline');
	});

	test('chooses a skin and an exact exterior', async ({ page }) => {
		const priced = watchPricing(page);
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');

		await expect(summary(page).getByText(/^1 \/ \d+ slots filled$/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Redline' })).toBeVisible();
		await expect(page.getByText('Field-Tested').first()).toBeVisible();
		// Browsing and selecting cost no market request.
		expect(priced()).toBe(0);
	});

	test('scopes the picker to the slot', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin for the AWP slot/ }).click();

		const dialog = page.getByRole('dialog', { name: 'Choose a AWP skin' });
		await expect(dialog.getByText('AWP').first()).toBeVisible();
		await expect(dialog.getByText('AK-47')).toHaveCount(0);
	});

	test('searches within the slot', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin for the AK-47 slot/ }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByRole('textbox', { name: /Search AK-47 skins/ }).fill('vulcan');

		await expect(dialog.getByText('Vulcan')).toBeVisible();
		await expect(dialog.getByText('Redline')).toHaveCount(0);
	});

	test('cancelling the picker changes nothing', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin for the AK-47 slot/ }).click();

		const dialog = page.getByRole('dialog');
		await dialog
			.getByRole('button', { name: /Redline/ })
			.first()
			.click();
		await dialog.getByRole('button', { name: 'Cancel' }).click();

		await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('prices only when asked, then shows a total and per-item prices', async ({ page }) => {
		const priced = watchPricing(page);
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await fillSlot(page, 'AWP', 'Asiimov');

		await expect(summary(page).getByText(/^2 \/ \d+ slots filled$/)).toBeVisible();
		await expect(summary(page).getByText('Prices not calculated yet.')).toBeVisible();
		expect(priced()).toBe(0);

		await summary(page).getByRole('button', { name: 'Check current prices' }).click();

		await expect(summary(page).getByText(/^R\$/).first()).toBeVisible();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();
		await expect(summary(page).getByText('Steam total')).toBeVisible();
		// A price on each filled slot, plus the total and the Steam figure.
		await expect(page.getByText(/R\$/)).not.toHaveCount(0);
		expect(priced()).toBe(1);
	});

	test('editing the loadout makes the previous total stale', async ({ page }) => {
		const priced = watchPricing(page);
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();

		await fillSlot(page, 'AWP', 'Asiimov');

		// An old total beside a changed loadout is wrong, not merely old.
		await expect(
			summary(page).getByText('Prices need updating — your loadout changed.')
		).toBeVisible();
		await expect(summary(page).getByText('Lowest price')).toHaveCount(0);
		expect(priced()).toBe(1);

		// Still "Check current prices": the loadout changed, so this is a first
		// calculation for a different set, not a repeat of the last one.
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();
		expect(priced()).toBe(2);
	});

	test('removing a selection frees the slot and invalidates the total', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();

		await page.getByRole('button', { name: /Remove Redline from the AK-47 slot/ }).click();

		await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
		await expect(summary(page).getByText('Lowest price')).toHaveCount(0);
		await expect(
			page.getByRole('button', { name: /Choose skin for the AK-47 slot/ })
		).toBeVisible();
	});

	test('replaces a selection in place', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await fillSlot(page, 'AK-47', 'Vulcan');

		await expect(summary(page).getByText(/^1 \/ \d+ slots filled$/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Vulcan' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Redline' })).toHaveCount(0);
	});

	test('clears the loadout after confirming', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Clear loadout' }).click();

		const confirm = page.getByRole('dialog', { name: /Clear your loadout/ });
		await expect(confirm).toBeVisible();

		await confirm.getByRole('button', { name: 'Keep loadout' }).click();
		await expect(summary(page).getByText(/^1 \/ \d+ slots filled$/)).toBeVisible();

		await summary(page).getByRole('button', { name: 'Clear loadout' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Clear loadout' }).click();

		await expect(summary(page).getByText(/^0 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('opens a selected skin at the exact variant that was chosen', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await page.getByRole('link', { name: 'Redline' }).click();

		await expect(page).toHaveURL('/skins/ak-47-redline?wear=Field-Tested');
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('fills the knife and gloves slots, which match on catalog subtype', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'Knife', 'Doppler');
		await fillSlot(page, 'Gloves', 'Vice');

		await expect(page.getByRole('link', { name: 'Doppler' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Vice' })).toBeVisible();
		await expect(summary(page).getByText(/^2 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('keeps a firearm out of the knife picker', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin for the Knife slot/ }).click();

		const dialog = page.getByRole('dialog', { name: 'Choose a Knife skin' });
		// `.first()` because more than one Karambit finish is in the fixture, and
		// the assertion still has to wait for the picker to load its options.
		await expect(dialog.getByText('Karambit').first()).toBeVisible();
		await expect(dialog.getByText('AK-47')).toHaveCount(0);
		await expect(dialog.getByText('Sport Gloves')).toHaveCount(0);
	});
});

test.describe('the builder on mobile', () => {
	test.use({ viewport: MOBILE });

	test('has no horizontal overflow, empty or filled', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		const overflows = async () =>
			page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);

		expect(await overflows()).toBe(false);

		await fillSlot(page, 'AK-47', 'Redline', 'Field-Tested');
		await summary(page).getByRole('button', { name: 'Check current prices' }).click();
		await expect(summary(page).getByText('Lowest price')).toBeVisible();

		expect(await overflows()).toBe(false);
	});

	test('keeps the picker usable at phone width', async ({ page }) => {
		await page.goto('/build');
		await ready(page);

		await fillSlot(page, 'Knife', 'Doppler');

		await expect(page.getByRole('link', { name: 'Doppler' })).toBeVisible();
	});
});
