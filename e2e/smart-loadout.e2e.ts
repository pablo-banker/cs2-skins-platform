import { expect, test, type Page } from '@playwright/test';

/**
 * Smart Loadout against the stubbed catalog (see playwright.config.ts).
 *
 * The journey that matters is preferences → generated loadout → builder: what a
 * visitor is promised on this page has to be the loadout they can then edit,
 * with the same skins at the same exteriors.
 *
 * The fixture covers **red** for every required Smart Core entry, plus a red
 * knife and red gloves, because the generator draws only on the curated visual
 * dataset. See `e2e/mock-cs2cap.mjs`.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

/** The generated-loadout panel. Absent until a generation succeeds. */
function result(page: Page) {
	return page.getByRole('region', { name: 'Your Smart Loadout' });
}

/** Sets the form up and presses Generate. */
async function generate(
	page: Page,
	options: { budget?: string; color?: string; style?: string; knife?: boolean; gloves?: boolean }
) {
	if (options.budget !== undefined) {
		await page.getByLabel('Maximum budget').fill(options.budget);
	}
	if (options.color) await page.getByLabel('Colour').selectOption(options.color);
	if (options.style) await page.getByLabel('Style').selectOption(options.style);
	if (options.knife) await page.getByLabel('Include a knife').check();
	if (options.gloves) await page.getByLabel('Include gloves').check();

	await page.getByRole('button', { name: 'Generate loadout' }).click();
}

test.describe('smart loadout on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('renders the form server-side, with no generation yet', async ({ page }) => {
		const response = await page.goto('/smart-loadout');

		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: 'Smart Loadout' })).toBeVisible();
		await expect(page.getByLabel('Maximum budget')).toBeVisible();

		// Nothing is priced until someone asks: no total, no skins, no prices.
		await expect(result(page)).toHaveCount(0);
		await expect(page.getByText('Pick a direction and generate to see a loadout.')).toBeVisible();
	});

	test('offers only colours that can fill every required slot', async ({ page }) => {
		await page.goto('/smart-loadout');

		const colors = page.getByLabel('Colour');

		await expect(colors.locator('option')).toContainText(['Any colour', 'Red']);
		// Nothing in the fixture is curated orange for all six entries.
		await expect(colors.locator('option', { hasText: /^Orange$/ })).toHaveCount(0);
	});

	test('cannot generate without a direction', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await expect(page.getByRole('button', { name: 'Generate loadout' })).toBeDisabled();
		await expect(page.getByText('Choose a colour or a style to generate.')).toBeVisible();

		await page.getByLabel('Colour').selectOption('red');
		await expect(page.getByRole('button', { name: 'Generate loadout' })).toBeEnabled();
	});

	test('generates a priced loadout within the budget', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });

		await expect(result(page)).toBeVisible();

		// Six required entries, every one of them a real curated red skin.
		const items = result(page).getByRole('listitem');
		await expect(items).toHaveCount(6);
		await expect(result(page)).toContainText('6 skins');

		// A price per item and a total, all in BRL.
		for (const cell of await items.all()) {
			await expect(cell.getByText(/^R\$\s/)).toBeVisible();
		}
		await expect(result(page).getByText('Current total')).toBeVisible();
		await expect(result(page).getByText('Remaining')).toBeVisible();
	});

	test('stays inside the budget it was given, and adds up', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		/** A rendered pt-BR amount back into minor units. */
		const minor = (text: string) => Number(text.replace(/[^\d,]/g, '').replace(',', ''));

		const figure = async (label: string) =>
			minor(
				await result(page).locator('dl > div', { hasText: label }).getByText(/R\$/).innerText()
			);

		const total = await figure('Current total');
		const remaining = await figure('Remaining');

		expect(total).toBeGreaterThan(0);
		expect(total).toBeLessThanOrEqual(500_000);
		// Remaining is budget minus total, exactly — no rounding anywhere.
		expect(total + remaining).toBe(500_000);

		// Every item price adds up to the total, so nothing is quietly excluded.
		const prices = await result(page)
			.getByRole('listitem')
			.getByText(/^R\$\s/)
			.allInnerTexts();

		expect(prices.reduce((sum, text) => sum + minor(text), 0)).toBe(total);
	});

	test('names the marketplace behind every price', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		for (const cell of await result(page).getByRole('listitem').all()) {
			await expect(cell.getByText(/Steam|CSFloat|Skins\.com|CS\.MONEY/)).toBeVisible();
		}
	});

	test('calls a lowest ask nothing more than it is', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		const body = (await page.locator('body').innerText()).toLowerCase();

		expect(body).not.toContain('market value');
		expect(body).not.toContain('average price');
		expect(body).not.toContain('fair price');
		expect(body).not.toContain('last sale');
	});

	test('opens a generated skin at the exterior it was priced at', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		const first = result(page).getByRole('listitem').first();
		const name = await first.getByRole('link').innerText();
		const href = await first.getByRole('link').getAttribute('href');

		expect(href).toMatch(/^\/skins\/[a-z0-9-]+\?wear=/);

		await first.getByRole('link').click();
		await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
	});

	test('hands the loadout to the builder, unchanged', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		// The finishes it generated, so the builder can be checked against them.
		const names = await result(page).getByRole('listitem').getByRole('link').allInnerTexts();
		expect(names).toHaveLength(6);

		await page.getByRole('link', { name: 'Open in Builder' }).click();

		await expect(page).toHaveURL(/^.*\/build\?loadout=/);
		await expect(page.getByRole('heading', { level: 1, name: 'Build your loadout' })).toBeVisible();

		// Every generated skin is in the builder, and the builder says so.
		for (const name of names) {
			await expect(page.getByRole('link', { name }).first()).toBeVisible();
		}
		await expect(page.getByText(/^6 \/ \d+ slots filled$/)).toBeVisible();
	});

	test('includes a knife and gloves when asked, and not before', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 50.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();
		await expect(result(page).getByText('Knife')).toHaveCount(0);
		await expect(result(page).getByText('Gloves')).toHaveCount(0);

		await generate(page, { color: 'red', knife: true, gloves: true });

		await expect(result(page)).toBeVisible();
		await expect(result(page).getByRole('listitem')).toHaveCount(8);
		await expect(result(page).getByText('Knife')).toBeVisible();
		await expect(result(page).getByText('Gloves')).toBeVisible();
		await expect(result(page)).toContainText('8 skins');
	});

	test('says the budget is too low, and what it would take', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5,00', color: 'red' });

		await expect(page.getByText('This budget is too low')).toBeVisible();
		// An honest figure from the shortlist it actually priced.
		await expect(page.getByText(/start around/)).toContainText(/R\$\s[\d.,]+/);
		await expect(result(page)).toHaveCount(0);
	});

	test('suggests dropping the extras rather than only raising the budget', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5,00', color: 'red', knife: true, gloves: true });

		await expect(page.getByText('This budget is too low')).toBeVisible();
		await expect(page.getByText(/leaving out the/)).toContainText('knife and gloves');
	});

	test('falls back to the colour when a style cannot be matched everywhere', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		// Red and dark: the AK, the Deagle and the AWP have exactly that, the
		// Glock and the M4 have red without it.
		await generate(page, { budget: 'R$ 5.000,00', color: 'red', style: 'dark' });

		await expect(result(page)).toBeVisible();
		await expect(result(page).getByRole('listitem')).toHaveCount(6);
		await expect(result(page)).toContainText('Red · Dark');
		await expect(page.getByText(/Some slots use the closest curated colour match/)).toBeVisible();
	});

	test('never substitutes a different colour', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red', style: 'dark' });
		await expect(result(page)).toBeVisible();

		// Blue and green finishes are curated in the fixture for these very
		// slots; a relaxed colour would let one in.
		for (const wrong of ['Blue Laminate', 'Ocean Topo', 'Blueprint', 'Bright Water']) {
			await expect(result(page).getByText(wrong)).toHaveCount(0);
		}
	});

	test('drops a result whose preferences have changed', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		await page.getByLabel('Maximum budget').fill('R$ 9.000,00');

		await expect(result(page)).toHaveCount(0);
		await expect(page.getByText(/Your choices changed — generate again/)).toBeVisible();
	});

	test('generates only when asked', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		let generations = 0;
		page.on('request', (request) => {
			if (request.url().includes('/api/smart-loadout/generate')) generations++;
		});

		await page.getByLabel('Colour').selectOption('red');
		await page.getByLabel('Style').selectOption('dark');
		await page.getByLabel('Maximum budget').fill('R$ 3.000,00');
		await ready(page);

		expect(generations).toBe(0);

		await page.getByRole('button', { name: 'Generate loadout' }).click();
		await expect(result(page)).toBeVisible();

		expect(generations).toBe(1);

		// No polling and no refresh button: the price cache is five minutes.
		await page.waitForTimeout(1500);
		expect(generations).toBe(1);
		await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0);
	});

	test('leaks nothing about the upstream or the server', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		const html = await page.content();

		expect(html).not.toContain('CS2Cap');
		expect(html).not.toContain('cs2cap');
		expect(html).not.toContain('lowest_ask');
		expect(html).not.toContain('market_hash_name');
		expect(html).not.toContain('CS2CAP_API_KEY');
		expect(html).not.toContain('e2e-stub-key');
		// Catalog item ids never reach the browser.
		expect(html).not.toContain('itemId');
		expect(html).not.toContain('item_id');
	});
});

test.describe('the generate endpoint', () => {
	test.use({ viewport: DESKTOP });

	test('refuses a request that is not preferences', async ({ request }) => {
		const cases = [
			{ color: 'red' },
			{ budgetMinor: 200_000 },
			{ budgetMinor: 0, color: 'red' },
			{ budgetMinor: 200_000, color: 'burgundy' },
			{ budgetMinor: 200_000, color: 'red', slotId: 'ak-47' },
			{ budgetMinor: 200_000, color: 'red', itemIds: [1000, 1001] }
		];

		for (const body of cases) {
			const response = await request.post('/api/smart-loadout/generate', { data: body });

			expect(response.status(), JSON.stringify(body)).toBe(400);
			expect(await response.text()).not.toMatch(/CS2Cap|lowest_ask|item_id/);
		}
	});

	test('answers a failed generation with a reason, not an error', async ({ request }) => {
		const response = await request.post('/api/smart-loadout/generate', {
			data: { budgetMinor: 100, color: 'red' }
		});

		expect(response.status()).toBe(200);

		const body = await response.json();

		expect(body.status).toBe('failed');
		expect(body.reason).toBe('budget-too-low');
		expect(body.minimumMinor).toBeGreaterThan(100);
	});

	test('returns application identity only', async ({ request }) => {
		const response = await request.post('/api/smart-loadout/generate', {
			data: { budgetMinor: 500_000, color: 'red' }
		});

		expect(response.status()).toBe(200);

		const text = await response.text();

		expect(text).not.toMatch(/itemId|item_id|lowest_ask|market_hash_name|rarity_color/);

		const body = await response.json();

		expect(body.status).toBe('generated');
		expect(body.loadout.selections).toHaveLength(6);
		for (const selection of body.loadout.selections) {
			expect(Object.keys(selection).sort()).toEqual(['skinSlug', 'slotId', 'variant']);
		}
	});
});

test.describe('smart loadout on mobile', () => {
	test.use({ viewport: MOBILE });

	test('has no horizontal overflow, before or after generating', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		const overflows = async () =>
			page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

		expect(await overflows()).toBe(false);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });
		await expect(result(page)).toBeVisible();

		expect(await overflows()).toBe(false);
	});

	test('keeps the form and the result both reachable', async ({ page }) => {
		await page.goto('/smart-loadout');
		await ready(page);

		await generate(page, { budget: 'R$ 5.000,00', color: 'red' });

		await expect(result(page)).toBeVisible();
		await expect(page.getByLabel('Maximum budget')).toBeVisible();
	});
});
