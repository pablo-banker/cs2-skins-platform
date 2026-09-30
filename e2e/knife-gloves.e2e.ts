import { expect, test, type Page } from '@playwright/test';

/**
 * The Knife + Gloves matcher, against the stubbed catalog and the **real**
 * curated dataset (see playwright.config.ts and `mock-cs2cap.mjs`).
 *
 * The journey that matters is skin → matcher → builder: someone who likes a
 * knife should be able to reach the gloves that go with it, see what the pair
 * costs, and carry both into the builder without retyping anything.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

/** Curated red-and-dark, and paired in real curation. */
const KNIFE = '/skins/karambit-crimson-web';
const GLOVES = '/skins/specialist-gloves-crimson-web';

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function sourcePanel(page: Page) {
	return page.getByRole('region', { name: /^Your (knife|gloves)$/ });
}

function results(page: Page) {
	return page.getByRole('region', { name: /^Matching (gloves|knives)$/ });
}

/** A rendered pt-BR amount back into minor units. */
function minor(text: string): number {
	return Number(text.replace(/[^\d,]/g, '').replace(',', ''));
}

/**
 * Clicks a link the way someone scrolling the page would.
 *
 * Playwright scrolls minimally, which parks a short element directly under the
 * sticky header; centring it first is what a person reading down the page
 * actually ends up with.
 */
async function clickInView(locator: ReturnType<Page['getByRole']>) {
	await locator.evaluate((element) => element.scrollIntoView({ block: 'center' }));
	await locator.click();
}

test.describe('from a knife', () => {
	test.use({ viewport: DESKTOP });

	test('offers the matcher on a curated knife page', async ({ page }) => {
		await page.goto(KNIFE);
		await ready(page);

		const cta = page.getByRole('region', { name: 'Find matching gloves' });

		await expect(cta).toBeVisible();
		// Below the market data: price comparison is what this page is for.
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});

	test('carries the exact exterior through to the matcher', async ({ page }) => {
		await page.goto(`${KNIFE}?wear=Factory+New`);
		await ready(page);

		await clickInView(
			page
				.getByRole('region', { name: 'Find matching gloves' })
				.getByRole('link', { name: 'Find matching gloves' })
		);

		await expect(page).toHaveURL(
			/\/knife-gloves\?skin=karambit-crimson-web&wear=Factory(%20|\+)New/
		);

		// The source is priced at the exterior that was chosen, not a default.
		await expect(sourcePanel(page).getByText('Factory New').first()).toBeVisible();
	});

	test('matches gloves, and only gloves', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		await expect(page.getByRole('heading', { name: 'Matching gloves' })).toBeVisible();

		const cards = results(page).getByRole('listitem');
		await expect(cards).not.toHaveCount(0);

		for (const card of await cards.all()) {
			const href = await card.getByRole('link').first().getAttribute('href');

			expect(href).toMatch(/gloves/);
			expect(href).not.toMatch(/karambit|bayonet/);
		}
	});

	test('never offers the source as its own match', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const hrefs = await results(page)
			.getByRole('link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

		expect(hrefs.some((href) => href?.includes('karambit-crimson-web'))).toBe(false);
	});

	test('prices the source and every match, and adds the pair up', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const sourceAmount = minor(
			await sourcePanel(page)
				.getByText(/^R\$\s/)
				.first()
				.innerText()
		);
		expect(sourceAmount).toBeGreaterThan(0);

		const first = results(page).getByRole('listitem').first();
		const amounts = await first.getByText(/^R\$\s/).allInnerTexts();

		// A match price and a pair total, and the total is exactly the sum.
		expect(amounts).toHaveLength(2);
		expect(minor(amounts[0]) + sourceAmount).toBe(minor(amounts[1]));
		await expect(first.getByText('Pair total')).toBeVisible();
	});

	test('names the marketplace behind each price', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		await expect(sourcePanel(page).getByText(/Steam|CSFloat|Skins\.com|CS\.MONEY/)).toBeVisible();

		for (const card of await results(page).getByRole('listitem').all()) {
			await expect(card.getByText(/Steam|CSFloat|Skins\.com|CS\.MONEY/)).toBeVisible();
		}
	});

	test('says once that a pair total can span marketplaces', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		await expect(page.getByText(/may be on different marketplaces/)).toHaveCount(1);
	});

	test('changes the source exterior through the URL', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const before = minor(
			await sourcePanel(page)
				.getByText(/^R\$\s/)
				.first()
				.innerText()
		);

		await page
			.getByRole('group', { name: 'Exterior' })
			.getByRole('link', { name: 'Factory New' })
			.click();

		await expect(page).toHaveURL(/wear=Factory(%20|\+)New/);

		const after = minor(
			await sourcePanel(page)
				.getByText(/^R\$\s/)
				.first()
				.innerText()
		);

		// Different variant, different item, different price.
		expect(after).not.toBe(before);
	});

	test('opens a match at the exact variant it priced', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const first = results(page).getByRole('listitem').first();
		const view = first.getByRole('link', { name: /^View / });
		const href = await view.getAttribute('href');

		expect(href).toMatch(/^\/skins\/[a-z0-9-]+\?wear=/);

		await view.click();
		await expect(page.getByRole('region', { name: 'Marketplace prices' })).toBeVisible();
	});
});

test.describe('from gloves', () => {
	test.use({ viewport: DESKTOP });

	test('offers the matcher on a curated gloves page', async ({ page }) => {
		await page.goto(GLOVES);
		await ready(page);

		await expect(page.getByRole('region', { name: 'Find matching knives' })).toBeVisible();
	});

	test('walks from gloves to matching knives', async ({ page }) => {
		await page.goto(GLOVES);
		await ready(page);

		await clickInView(
			page
				.getByRole('region', { name: 'Find matching knives' })
				.getByRole('link', { name: 'Find matching knives' })
		);

		await expect(page).toHaveURL(/\/knife-gloves\?skin=specialist-gloves-crimson-web/);
		await expect(page.getByRole('region', { name: 'Your gloves' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Matching knives' })).toBeVisible();

		const hrefs = await results(page)
			.getByRole('link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

		// Knives only, and not this pair of gloves.
		expect(hrefs.some((href) => href?.includes('karambit'))).toBe(true);
		expect(hrefs.some((href) => href?.includes('specialist-gloves-crimson-web'))).toBe(false);
	});
});

test.describe('handing a pair to the builder', () => {
	test.use({ viewport: DESKTOP });

	test('fills exactly one knife slot and one gloves slot', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const first = results(page).getByRole('listitem').first();
		const glove = await first.getByRole('link', { name: /^View / }).innerText();

		await first.getByRole('link', { name: /Open pair in Builder/ }).click();

		await expect(page).toHaveURL(/\/build\?loadout=/);
		await expect(page.getByRole('heading', { level: 1, name: 'Build your loadout' })).toBeVisible();

		// Two slots filled: the knife that was the source, and the gloves picked.
		await expect(page.getByText(/^2 \/ \d+ slots filled$/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Crimson Web' }).first()).toBeVisible();
		await expect(
			page.getByRole('link', { name: glove.replace(/^View /, '') }).first()
		).toBeVisible();
	});
});

test.describe('what the matcher costs the browser', () => {
	test.use({ viewport: DESKTOP });

	test('fetches nothing client-side and never reaches the provider', async ({ page }) => {
		const api: string[] = [];
		const upstream: string[] = [];

		page.on('request', (request) => {
			if (request.url().includes('/api/')) api.push(request.url());
			if (request.url().includes(':4180/')) upstream.push(request.url());
		});

		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		// Server-rendered: no matcher endpoint exists, and none is wanted.
		expect(api).toEqual([]);
		expect(upstream).toEqual([]);
		await expect(results(page).getByRole('listitem')).not.toHaveCount(0);
	});

	test('renders no price history', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		// History belongs to the skin page. This one is current prices only.
		await expect(page.getByText(/Price history|30-day/)).toHaveCount(0);
	});
});

test.describe('choosing a source on the page', () => {
	test.use({ viewport: DESKTOP });

	test('starts with a picker rather than empty cards', async ({ page }) => {
		const response = await page.goto('/knife-gloves');

		expect(response?.status()).toBe(200);
		await ready(page);

		await expect(page.getByText('Choose a knife or gloves skin')).toBeVisible();
		await expect(results(page)).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Choose skin/ })).toBeVisible();
	});

	test('picks a source and matches it', async ({ page }) => {
		await page.goto('/knife-gloves');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin/ }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await dialog.getByRole('combobox').fill('karambit crimson');
		await dialog.getByRole('option').first().click();

		await expect(page).toHaveURL(/\/knife-gloves\?skin=karambit-crimson-web/);
		await expect(results(page).getByRole('listitem')).not.toHaveCount(0);
	});

	test('offers only knives and gloves, grouped', async ({ page }) => {
		await page.goto('/knife-gloves');
		await ready(page);

		await page.getByRole('button', { name: /Choose skin/ }).click();

		const dialog = page.getByRole('dialog');

		await expect(dialog.getByText('Knives', { exact: true })).toBeVisible();
		await expect(dialog.getByText('Gloves', { exact: true })).toBeVisible();
		// No rifles in a knife-and-gloves picker.
		await expect(dialog.getByText('AK-47')).toHaveCount(0);
	});
});

test.describe('states someone can recover from', () => {
	test.use({ viewport: DESKTOP });

	test('an unknown slug is a bad choice, not a missing page', async ({ page }) => {
		const response = await page.goto('/knife-gloves?skin=not-a-real-skin');

		expect(response?.status()).toBe(200);
		await ready(page);

		await expect(page.getByText('This skin could not be loaded')).toBeVisible();
		await expect(page.getByRole('button', { name: /Choose skin/ })).toBeVisible();
	});

	test('a firearm is refused, recoverably', async ({ page }) => {
		const response = await page.goto('/knife-gloves?skin=ak-47-redline');

		expect(response?.status()).toBe(200);
		await ready(page);

		await expect(page.getByText('This matcher works on knives and gloves')).toBeVisible();
		await expect(page.getByRole('button', { name: /Choose skin/ })).toBeVisible();
	});

	test('an uncurated knife is named, not faked', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-doppler');
		await ready(page);

		await expect(page.getByText(/isn't in our curated matching collection yet/)).toBeVisible();
		await expect(results(page)).toHaveCount(0);
	});

	test('no curated counterpart says so instead of lowering the bar', async ({ page }) => {
		// Sport Gloves | Vice is pink and cyan; nothing in the fixture's knives
		// reaches the threshold against it.
		await page.goto('/knife-gloves?skin=sport-gloves-vice');
		await ready(page);

		await expect(page.getByRole('region', { name: 'Your gloves' })).toBeVisible();
		await expect(page.getByText('No strong curated matches yet.')).toBeVisible();
		await expect(results(page).getByRole('listitem')).toHaveCount(0);
	});

	test('an uncurated knife page offers no matcher link', async ({ page }) => {
		await page.goto('/skins/karambit-doppler');
		await ready(page);

		await expect(page.getByText(/Find matching/)).toHaveCount(0);
	});

	test('a firearm page offers no matcher link', async ({ page }) => {
		await page.goto('/skins/ak-47-redline');
		await ready(page);

		await expect(page.getByText(/Find matching/)).toHaveCount(0);
	});
});

test.describe('the matcher on mobile', () => {
	test.use({ viewport: MOBILE });

	test('stacks without horizontal overflow', async ({ page }) => {
		await page.goto('/knife-gloves?skin=karambit-crimson-web');
		await ready(page);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
		await expect(sourcePanel(page)).toBeVisible();
		await expect(results(page).getByRole('listitem').first()).toBeVisible();
	});

	test('keeps the empty state usable', async ({ page }) => {
		await page.goto('/knife-gloves');
		await ready(page);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
		await expect(page.getByRole('button', { name: /Choose skin/ })).toBeVisible();
	});
});
