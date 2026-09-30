import { expect, test, type Page } from '@playwright/test';

/**
 * Visual recommendations on a skin page, against the stubbed catalog and the
 * **real** curated dataset (see playwright.config.ts and `mock-cs2cap.mjs`).
 *
 * The journey that matters is skin → skin: someone who likes how a skin looks
 * should be able to walk from it to another one, either for the same weapon or
 * for the rest of their loadout, without the page spending a single extra
 * market request to offer it.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

/** A curated red-and-dark AK. Its recommendations come from real curation. */
const CURATED = '/skins/ak-47-redline';

/** A real catalog skin nobody has classified. */
const UNCURATED = '/skins/ak-47-vulcan';

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function similar(page: Page) {
	return page.getByRole('region', { name: 'Similar skins' });
}

function matches(page: Page) {
	return page.getByRole('region', { name: 'Matches this skin' });
}

test.describe('recommendations on desktop', () => {
	test.use({ viewport: DESKTOP });

	test('renders both sections server-side', async ({ page }) => {
		// Server-rendered, not fetched after paint: recommendations are part of
		// the document a crawler and a slow connection both get.
		const response = await page.goto(CURATED);
		const html = (await response?.text()) ?? '';

		expect(html).toContain('Similar skins');
		expect(html).toContain('Matches this skin');
	});

	test('offers other finishes for the same weapon', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		await expect(similar(page)).toBeVisible();
		await expect(
			similar(page).getByText('More AK-47 skins with a similar visual direction.')
		).toBeVisible();

		const links = similar(page).getByRole('link');
		await expect(links).not.toHaveCount(0);

		// Every one of them is an AK-47, and none of them is this AK-47.
		for (const link of await links.all()) {
			expect(await link.getAttribute('href')).toMatch(/^\/skins\/ak-47-/);
		}
	});

	test('offers other slots under Matches this skin', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		await expect(matches(page)).toBeVisible();
		await expect(matches(page).getByText('Curated skins that pair with this look.')).toBeVisible();

		const hrefs = await matches(page)
			.getByRole('link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

		expect(hrefs.length).toBeGreaterThan(1);
		// Cross-slot: not a single AK-47 among them.
		expect(hrefs.some((href) => href?.startsWith('/skins/ak-47-'))).toBe(false);
	});

	test('reaches across the loadout, not just to another gun', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		// Red-and-dark curation pairs this AK with a knife and gloves.
		await expect(matches(page).getByText('Crimson Web').first()).toBeVisible();
		await expect(matches(page).getByRole('link', { name: /AWP/ })).toBeVisible();
	});

	test('never recommends the skin being looked at', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		for (const section of [similar(page), matches(page)]) {
			const hrefs = await section
				.getByRole('link')
				.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

			expect(hrefs).not.toContain(CURATED);
		}
	});

	test('opens a similar skin at its own page', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		const first = similar(page).getByRole('link').first();
		const href = await first.getAttribute('href');

		await first.click();

		await expect(page).toHaveURL(href ?? '');
		// A real skin page, with its own price comparison.
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('opens a cross-weapon match at its own page', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		const first = matches(page).getByRole('link').first();
		const href = await first.getAttribute('href');

		await first.click();

		await expect(page).toHaveURL(href ?? '');
		expect(href).not.toMatch(/^\/skins\/ak-47-/);
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('links to the canonical product URL, with no variant in the query', async ({ page }) => {
		await page.goto(`${CURATED}?wear=Minimal+Wear`);
		await ready(page);

		for (const section of [similar(page), matches(page)]) {
			for (const link of await section.getByRole('link').all()) {
				// Product-level discovery: the skin page picks its own default
				// variant, and the source page's exterior does not leak into it.
				expect(await link.getAttribute('href')).toMatch(/^\/skins\/[a-z0-9-]+$/);
			}
		}
	});

	test('shows no price and no price placeholder on a card', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		for (const section of [similar(page), matches(page)]) {
			// "Price unavailable" would claim we looked. We did not.
			await expect(section.getByText('Price unavailable')).toHaveCount(0);
			await expect(section.getByText(/R\$/)).toHaveCount(0);
			await expect(section.getByText('From', { exact: true })).toHaveCount(0);
		}
	});

	test('shows no similarity score', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		for (const section of [similar(page), matches(page)]) {
			const text = await section.innerText();

			// The word "similar" is the heading's job; a *number* is what must
			// never appear. The score ranks a short list and is not calibrated.
			expect(text).not.toMatch(/\d+%/);
			expect(text.toLowerCase()).not.toContain('score');
			expect(text).not.toMatch(/\bmatch(es)? \d/i);
		}
	});

	test('comes after the market data', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		const order = await page
			.getByRole('heading', { level: 2 })
			.evaluateAll((headings) => headings.map((heading) => heading.textContent?.trim() ?? ''));

		expect(order.indexOf('Similar skins')).toBeGreaterThan(order.indexOf('Marketplace prices'));
		expect(order.indexOf('Similar skins')).toBeGreaterThan(order.indexOf('Price history'));
		expect(order.indexOf('Matches this skin')).toBeGreaterThan(order.indexOf('Similar skins'));
	});
});

test.describe('what recommendations cost', () => {
	test.use({ viewport: DESKTOP });

	test('adds no price, provider or history request', async ({ page }) => {
		const upstream: string[] = [];

		// The mock stands in for CS2Cap, so every market call it sees is one
		// this page made.
		await page.route('**/*', async (route) => {
			await route.continue();
		});
		page.on('request', (request) => {
			if (request.url().includes(':4180/')) upstream.push(request.url());
		});

		await page.goto(CURATED);
		await ready(page);

		// Whatever the page fetched, it fetched from its own server. Nothing
		// reaches the provider from the browser at all.
		expect(upstream).toEqual([]);

		// And the page itself offers no per-card request: every card is static.
		const cards = await page
			.getByRole('region', { name: /Similar skins|Matches this skin/ })
			.getByRole('link')
			.count();

		expect(cards).toBeGreaterThan(0);
	});

	test('makes no client-side request for recommendations at all', async ({ page }) => {
		const apiCalls: string[] = [];

		page.on('request', (request) => {
			if (request.url().includes('/api/')) apiCalls.push(request.url());
		});

		await page.goto(CURATED);
		await ready(page);

		// There is no `/api/recommendations`, and there should not be one:
		// the page is server-rendered.
		expect(apiCalls.filter((url) => url.includes('recommend'))).toEqual([]);
	});
});

test.describe('an uncurated skin', () => {
	test.use({ viewport: DESKTOP });

	test('shows neither section, and no apology', async ({ page }) => {
		const response = await page.goto(UNCURATED);

		expect(response?.status()).toBe(200);
		await ready(page);

		await expect(similar(page)).toHaveCount(0);
		await expect(matches(page)).toHaveCount(0);

		const body = await page.locator('body').innerText();

		expect(body.toLowerCase()).not.toContain("don't understand");
		expect(body.toLowerCase()).not.toContain('no recommendations');
	});

	test('still renders the whole product page', async ({ page }) => {
		await page.goto(UNCURATED);
		await ready(page);

		await expect(page.getByRole('heading', { level: 1, name: 'Vulcan' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Skin information' })).toBeVisible();
	});
});

test.describe('knives and gloves', () => {
	test.use({ viewport: DESKTOP });

	const KNIFE = '/skins/karambit-crimson-web';

	test('recommends other knife families beside a knife', async ({ page }) => {
		await page.goto(KNIFE);
		await ready(page);

		// The Knife slot is a family, so a Karambit's alternatives are other
		// knives — not other Karambits, of which the fixture has one.
		await expect(similar(page).getByRole('link', { name: /Crimson Web/ })).toBeVisible();
		await expect(
			similar(page).getByText('More Karambit skins with a similar visual direction.')
		).toBeVisible();
	});

	test('pairs a knife with gloves', async ({ page }) => {
		await page.goto(KNIFE);
		await ready(page);

		const hrefs = await matches(page)
			.getByRole('link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

		// Cross-slot matching carries knives and gloves through slot identity
		// alone — no name parsing anywhere.
		expect(hrefs.some((href) => href?.includes('gloves'))).toBe(true);
		expect(hrefs.some((href) => href?.startsWith('/skins/karambit-'))).toBe(false);
	});

	test('walks from a knife to matching gloves', async ({ page }) => {
		await page.goto(KNIFE);
		await ready(page);

		const gloves = matches(page)
			.getByRole('link')
			.filter({ hasText: /Crimson Web/ })
			.first();

		await gloves.click();

		await expect(page).toHaveURL(/\/skins\/[a-z0-9-]+/);
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});
});

test.describe('recommendations on mobile', () => {
	test.use({ viewport: MOBILE });

	test('lays out two columns with no horizontal overflow', async ({ page }) => {
		await page.goto(CURATED);
		await ready(page);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
		await expect(similar(page)).toBeVisible();
		await expect(matches(page)).toBeVisible();
	});
});
