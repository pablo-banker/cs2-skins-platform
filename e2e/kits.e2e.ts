import { expect, test, type Page } from '@playwright/test';

/**
 * Editorial kits against the stubbed catalog (see playwright.config.ts).
 *
 * The journey that matters is kit → skin: a visitor who likes a kit must land
 * on the exact skin, at the exact exterior, the kit was built around.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

test.describe('kits on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('renders the catalog server-side', async ({ page }) => {
		const response = await page.goto('/kits');

		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: 'Kits' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Crimson' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Midnight' })).toBeVisible();
	});

	test('shows what a kit contains without pricing it', async ({ page }) => {
		// Kit pricing is a later phase; until then no price, real or empty,
		// may appear on the catalog.
		await page.goto('/kits');

		await expect(page.getByText('5 skins').first()).toBeVisible();
		await expect(page.getByText('Price unavailable')).toHaveCount(0);
		await expect(page.getByText(/R\$/)).toHaveCount(0);
	});

	test('opens a kit from its card', async ({ page }) => {
		await page.goto('/kits');
		await ready(page);

		await page.getByRole('heading', { level: 3, name: 'Midnight' }).click();

		await expect(page).toHaveURL('/kits/midnight');
		await expect(page.getByRole('heading', { level: 1, name: 'Midnight' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Included skins' })).toBeVisible();
	});

	test('opens an included skin at the exterior the kit intends', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		const items = page.getByRole('region', { name: 'Included skins' });
		await items.getByText('Graphite').click();

		// Midnight names the Minimal Wear AWP | Graphite, so the skin page must
		// open there rather than on its default exterior.
		await expect(page).toHaveURL('/skins/awp-graphite?wear=Minimal%20Wear');
		await expect(page.getByRole('heading', { level: 1, name: 'Graphite' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('walks back to the catalog through the breadcrumb', async ({ page }) => {
		await page.goto('/kits/crimson');
		await ready(page);

		await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link').click();

		await expect(page).toHaveURL('/kits');
	});

	test('404s an unknown kit instead of falling back to the first', async ({ page }) => {
		const response = await page.goto('/kits/not-a-real-kit');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	});

	test('marks Kits as the current section, on a kit as well as the catalog', async ({ page }) => {
		const nav = page.getByRole('navigation', { name: 'Main' });

		for (const path of ['/kits', '/kits/crimson']) {
			await page.goto(path);

			await expect(nav.getByRole('link', { name: 'Kits', exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
		}
	});
});

test.describe('kits on mobile', () => {
	test.use({ viewport: MOBILE });

	test('has no horizontal overflow on the catalog or a kit', async ({ page }) => {
		for (const path of ['/kits', '/kits/crimson']) {
			await page.goto(path);
			await ready(page);

			const overflows = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);

			expect(overflows, path).toBe(false);
		}
	});

	test('still reaches a skin from a kit', async ({ page }) => {
		await page.goto('/kits/crimson');
		await ready(page);

		await page.getByRole('region', { name: 'Included skins' }).getByText('Check Engine').click();

		await expect(page).toHaveURL('/skins/usp-s-check-engine?wear=Minimal%20Wear');
	});
});

/**
 * Kit pricing against the stubbed market.
 *
 * The stub makes Steam undercut everyone on odd item ids only, so a mixed kit
 * is cheapest across two marketplaces while Skins.com — which quotes
 * everything — can still supply the whole kit alone. That is what gives the
 * two purchase strategies something to disagree about.
 */
test.describe('kit pricing on desktop', () => {
	test.use({ viewport: DESKTOP });

	function summary(page: Page) {
		return page.getByRole('region', { name: 'Purchase plan' });
	}

	test('prices a kit server-side, with a total and a Steam comparison', async ({ page }) => {
		const response = await page.goto('/kits/midnight');

		expect(response?.status()).toBe(200);
		await expect(page.getByText('Lowest price').first()).toBeVisible();
		await expect(page.getByText('Steam total')).toBeVisible();
		await expect(page.getByText(/lower than Steam/)).toBeVisible();
		await expect(page.getByText(/Final checkout prices may differ/)).toBeVisible();
	});

	test('prices the exact variants the kit names', async ({ page }) => {
		await page.goto('/kits/midnight');

		const items = page.getByRole('region', { name: 'Included skins' });

		// Midnight names the Minimal Wear AWP | Graphite.
		await expect(items.getByText('Minimal Wear')).toBeVisible();
		await expect(items.getByText('Field-Tested').first()).toBeVisible();
		// Every row carries a price and a marketplace.
		await expect(items.getByText(/R\$/)).toHaveCount(5);
	});

	test('switches strategy without another request', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		const plan = summary(page);
		const totalBefore = await plan.getByText(/R\$/).first().innerText();
		const marketsBefore = await plan.getByText(/^\d+$/).first().innerText();

		let marketRequests = 0;
		page.on('request', (request) => {
			if (/\/kits|\/api\//.test(new URL(request.url()).pathname)) marketRequests++;
		});

		await page.getByRole('tab', { name: 'Fewer marketplaces' }).click();

		await expect(page.getByRole('tab', { name: 'Fewer marketplaces' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		const totalAfter = await plan.getByText(/R\$/).first().innerText();
		const marketsAfter = await plan.getByText(/^\d+$/).first().innerText();

		// Fewer marketplaces: one, and it costs more than the cheapest split.
		expect(Number(marketsBefore)).toBeGreaterThan(Number(marketsAfter));
		expect(totalAfter).not.toBe(totalBefore);
		expect(marketRequests).toBe(0);
	});

	test('groups the plan by marketplace with its own subtotal and offer links', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		const group = page.getByRole('region', { name: /^Buy from / }).first();

		await expect(group).toBeVisible();
		await expect(group.getByText('Subtotal')).toBeVisible();

		const offer = group.getByRole('link', { name: /View offer/ }).first();
		await expect(offer).toHaveAttribute('href', /cs2c\.app\/r\//);
		await expect(offer).toHaveAttribute('target', '_blank');
	});

	test('presents one plan when both strategies agree', async ({ page }) => {
		// Every Crimson item is cheapest on the same marketplace.
		await page.goto('/kits/crimson');

		await expect(
			page.getByText('The lowest-price plan already uses the fewest marketplaces.')
		).toBeVisible();
		await expect(page.getByRole('tab')).toHaveCount(0);
	});

	test('degrades to no total when one item has no current price', async ({ page }) => {
		// Cobalt contains the skin the stub leaves unpriced.
		const response = await page.goto('/kits/cobalt');

		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: 'Cobalt' })).toBeVisible();
		await expect(page.getByText('Total unavailable')).toBeVisible();
		await expect(page.getByText('No current prices')).toBeVisible();
		await expect(page.getByText('Purchase plan unavailable')).toBeVisible();
		// The items that do have prices still show them.
		await expect(page.getByRole('region', { name: 'Included skins' }).getByText(/R\$/)).toHaveCount(
			4
		);
	});

	test('opens an included skin at the exact variant that was priced', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		await page.getByRole('region', { name: 'Included skins' }).getByText('Graphite').click();

		await expect(page).toHaveURL('/skins/awp-graphite?wear=Minimal%20Wear');
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});
});

test.describe('kit pricing on mobile', () => {
	test.use({ viewport: MOBILE });

	test('stacks the plan without horizontal overflow', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		await expect(page.getByText('Lowest price').first()).toBeVisible();
		await expect(page.getByRole('region', { name: /^Buy from / }).first()).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);

		expect(overflows).toBe(false);
	});

	test('keeps the strategy switch usable', async ({ page }) => {
		await page.goto('/kits/midnight');
		await ready(page);

		await page.getByRole('tab', { name: 'Fewer marketplaces' }).click();

		await expect(page.getByRole('tab', { name: 'Fewer marketplaces' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});
