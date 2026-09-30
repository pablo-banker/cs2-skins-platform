import { expect, test, type Page } from '@playwright/test';

/**
 * The homepage, against the production build and the stubbed catalog.
 *
 * Two things matter here and nothing else does. A first-time visitor has to be
 * able to go from the front door to a priced skin, and the front door itself
 * has to cost nothing — a cold visit that spends metered price requests is the
 * one performance mistake this page could make.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function searchField(page: Page) {
	return page.getByLabel('Search for a skin');
}

function searchResults(page: Page) {
	return page.getByRole('list', { name: 'Search results' });
}

test.describe('the first-time journey', () => {
	test.use({ viewport: DESKTOP });

	test('says what the product is, server-side', async ({ page }) => {
		const response = await page.goto('/');
		const html = (await response?.text()) ?? '';

		expect(response?.status()).toBe(200);
		// The copy and the navigation are in the document, not assembled after
		// paint — a crawler and a slow connection get the same page.
		expect(html).toContain('Find the right CS2 skin');
		expect(html).toContain('Where to start');
		expect(html).toContain('/smart-loadout');
	});

	test('finds a specific skin and opens it', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await searchField(page).fill('redline');

		await expect(searchResults(page)).toBeVisible();
		const first = searchResults(page).getByRole('link').first();
		const href = await first.getAttribute('href');

		expect(href).toMatch(/^\/skins\/[a-z0-9-]+$/);

		await first.click();

		await expect(page).toHaveURL(href ?? '');
		// And *here* is where prices belong.
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('offers the whole result set as well as the shortlist', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await searchField(page).fill('redline');
		await expect(searchResults(page)).toBeVisible();

		await page.getByRole('link', { name: /View all results/ }).click();

		await expect(page).toHaveURL(/\/explore\?q=redline/);
	});

	test('says nothing was found rather than showing an empty panel', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await searchField(page).fill('zzzzzzzz');

		await expect(page.getByText(/No skins found for/)).toBeVisible();
	});
});

test.describe('the workflow entry points', () => {
	test.use({ viewport: DESKTOP });

	const destinations: [string, string, RegExp][] = [
		['Explore', 'Compare prices', /\/explore$/],
		['Builder', 'Build a loadout', /\/build$/],
		['Smart Loadout', 'Smart Loadout', /\/smart-loadout$/],
		['Kits', 'Curated kits', /\/kits$/]
	];

	for (const [label, name, url] of destinations) {
		test(`reaches ${label}`, async ({ page }) => {
			await page.goto('/');
			await ready(page);

			await page
				.getByRole('region', { name: 'Where to start' })
				.getByRole('link', { name: new RegExp(name) })
				.click();

			await expect(page).toHaveURL(url);
		});
	}

	test('reaches the Knife + Gloves matcher', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('link', { name: 'Find a pairing' }).click();

		await expect(page).toHaveURL(/\/knife-gloves$/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Knife + Gloves');
	});

	test('reaches the wishlist, which the header also offers', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		// Exact: "View your wishlist" below would match a substring too.
		await expect(page.getByRole('link', { name: 'Wishlist', exact: true })).toBeVisible();

		await page.getByRole('link', { name: 'View your wishlist' }).click();

		await expect(page).toHaveURL(/\/wishlist$/);
	});

	test('previews curated kits and opens one', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const section = page.getByRole('region', { name: 'Curated kits' });

		await expect(section.getByRole('listitem')).toHaveCount(3);
		// No price on a kit, anywhere.
		await expect(section.getByText(/R\$/)).toHaveCount(0);

		// A kit card, not the "View all kits" button that shares the section.
		await section.getByRole('listitem').first().getByRole('link').first().click();

		await expect(page).toHaveURL(/\/kits\/[a-z0-9-]+$/);
	});

	test('offers all the kits', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.getByRole('link', { name: 'View all kits' }).click();

		await expect(page).toHaveURL(/\/kits$/);
	});
});

test.describe('what the homepage costs', () => {
	test.use({ viewport: DESKTOP });

	/** Every request the browser made, and every one the server made upstream. */
	function watch(page: Page) {
		const urls: string[] = [];

		page.on('request', (request) => urls.push(request.url()));

		return urls;
	}

	const MARKET =
		/\/prices|\/candles|\/providers|\/api\/build\/prices|\/api\/wishlist|\/api\/smart-loadout/;

	test('a cold visit spends no market request at all', async ({ page }) => {
		const urls = watch(page);

		await page.goto('/');
		await ready(page);

		expect(urls.filter((url) => MARKET.test(url))).toEqual([]);
		// And nothing reaches the provider from the browser either.
		expect(urls.filter((url) => url.includes(':4180/'))).toEqual([]);
	});

	test('typing stays free too', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const urls = watch(page);

		await searchField(page).fill('redline');
		await expect(searchResults(page)).toBeVisible();

		// Exactly one kind of request: our own search endpoint.
		const data = urls.filter((url) => url.includes('/api/'));

		expect(data.length).toBeGreaterThan(0);
		expect(data.every((url) => url.includes('/api/search/skins'))).toBe(true);
		expect(urls.filter((url) => MARKET.test(url))).toEqual([]);
	});

	test('renders no price and no history anywhere', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await expect(page.getByText(/R\$/)).toHaveCount(0);
		await expect(page.getByText(/Price history|30-day/)).toHaveCount(0);
	});
});

test.describe('what the homepage never claims', () => {
	test.use({ viewport: DESKTOP });

	test('invents no popularity, social proof, account or paid tier', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const body = (await page.locator('body').innerText()).toLowerCase();

		// None of these have anything behind them.
		for (const claim of [
			'trending',
			'most popular',
			'most searched',
			'trusted by',
			'sign up',
			'log in',
			'create account',
			'premium',
			'upgrade'
		]) {
			expect(body, claim).not.toContain(claim);
		}
	});

	test('says it does not sell skins', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await expect(page.getByText(/don't sell skins/)).toBeVisible();
	});
});

test.describe('the homepage on mobile', () => {
	test.use({ viewport: MOBILE });

	test('has no horizontal overflow', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
	});

	test('keeps the search usable', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await searchField(page).fill('redline');

		await expect(searchResults(page)).toBeVisible();

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
	});
});
