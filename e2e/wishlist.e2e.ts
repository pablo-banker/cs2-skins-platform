import { expect, test, type Page } from '@playwright/test';

/**
 * The wishlist, against the production build and the stubbed catalog.
 *
 * The journey that matters is skin → save → wishlist → still there tomorrow.
 * Because the list lives in `localStorage`, "still there" means surviving a
 * reload, which is the one thing a unit test cannot prove.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const REDLINE = '/skins/ak-47-redline';
const STORAGE_KEY = 'cs2-skins:wishlist:v1';

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

function saveButton(page: Page) {
	return page.getByRole('button', { name: /wishlist/i });
}

function cards(page: Page) {
	return page.getByRole('list', { name: 'Saved skins' }).getByRole('listitem');
}

/** What the browser actually has stored. */
async function stored(page: Page) {
	return page.evaluate((key) => {
		const raw = localStorage.getItem(key);

		return raw ? JSON.parse(raw) : null;
	}, STORAGE_KEY);
}

test.describe('saving from a skin page', () => {
	test.use({ viewport: DESKTOP });

	test('offers a save control that does not navigate away', async ({ page }) => {
		await page.goto(REDLINE);
		await ready(page);

		await expect(saveButton(page)).toHaveText(/Add to wishlist/);

		await saveButton(page).click();

		await expect(page).toHaveURL(REDLINE);
		await expect(saveButton(page)).toHaveText(/In wishlist/);
	});

	test('stores the exact variant and an add-time price', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);

		await saveButton(page).click();

		const payload = await stored(page);

		expect(payload.version).toBe(1);
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]).toMatchObject({
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Field-Tested', edition: 'normal' }
		});
		expect(payload.items[0].addedPriceMinor).toBeGreaterThan(0);
		// Canonical identity only — nothing upstream reaches storage.
		expect(JSON.stringify(payload)).not.toMatch(/itemId|marketHashName|providerId/);
	});

	test('shows the saved skin on the wishlist', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.getByRole('link', { name: 'Wishlist' }).click();

		await expect(page).toHaveURL('/wishlist');
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Redline');
		await expect(cards(page).first()).toContainText('Field-Tested');
	});

	test('survives a reload', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(1);

		await page.reload();
		await ready(page);

		await expect(cards(page)).toHaveCount(1);
	});

	test('shows as saved when the skin page is revisited', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);

		await expect(saveButton(page)).toHaveText(/In wishlist/);
	});
});

test.describe('exact variants', () => {
	test.use({ viewport: DESKTOP });

	test('a second exterior of a saved skin is not marked saved', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto(`${REDLINE}?wear=Minimal+Wear`);
		await ready(page);

		// The failure this guards: treating the grouped skin as wishlisted.
		await expect(saveButton(page)).toHaveText(/Add to wishlist/);
	});

	test('both exteriors can be saved, independently', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto(`${REDLINE}?wear=Minimal+Wear`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');

		await expect(cards(page)).toHaveCount(2);

		const payload = await stored(page);
		const wears = payload.items.map((item: { variant: { wear?: string } }) => item.variant.wear);

		expect(new Set(wears)).toEqual(new Set(['Field-Tested', 'Minimal Wear']));
		// Two variants, two independent baselines.
		expect(payload.items[0].addedPriceMinor).not.toBe(payload.items[1].addedPriceMinor);
	});

	test('each card links back to its own exterior', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Minimal+Wear`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');

		const view = cards(page).first().getByRole('link', { name: 'View skin' });

		await expect(view).toHaveAttribute('href', '/skins/ak-47-redline?wear=Minimal%20Wear');
	});
});

test.describe('price movement', () => {
	test.use({ viewport: DESKTOP });

	/** Seeds a baseline directly, so the movement is exact and deliberate. */
	async function seed(page: Page, addedPriceMinor: number) {
		await page.goto('/wishlist');
		await page.evaluate(
			({ key, addedPriceMinor }) =>
				localStorage.setItem(
					key,
					JSON.stringify({
						version: 1,
						items: [
							{
								skinSlug: 'ak-47-redline',
								variant: { wear: 'Field-Tested' },
								addedAt: '2026-09-01T00:00:00.000Z',
								addedPriceMinor,
								currency: 'BRL'
							}
						]
					})
				),
			{ key: STORAGE_KEY, addedPriceMinor }
		);
	}

	/** The current price the fixture quotes for this exact variant. */
	async function currentMinor(page: Page): Promise<number> {
		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(1);

		const text = await cards(page)
			.first()
			.getByText(/^R\$\s/)
			.first()
			.innerText();

		return Number(text.replace(/[^\d,]/g, '').replace(',', ''));
	}

	test('says how much lower, exactly', async ({ page }) => {
		await seed(page, 1);
		const current = await currentMinor(page);

		// A baseline R$ 30,00 above the current price.
		await seed(page, current + 3000);
		await page.goto('/wishlist');

		await expect(cards(page).first()).toContainText('R$ 30,00 lower since added');
	});

	test('says how much higher, exactly', async ({ page }) => {
		await seed(page, 1);
		const current = await currentMinor(page);

		await seed(page, current - 1820);
		await page.goto('/wishlist');

		await expect(cards(page).first()).toContainText('R$ 18,20 higher since added');
	});

	test('says when nothing moved', async ({ page }) => {
		await seed(page, 1);
		const current = await currentMinor(page);

		await seed(page, current);
		await page.goto('/wishlist');

		await expect(cards(page).first()).toContainText('No change since added');
	});

	test('never speaks in portfolio terms', async ({ page }) => {
		await seed(page, 1);
		const current = await currentMinor(page);
		await seed(page, current + 3000);
		await page.goto('/wishlist');

		const body = (await page.locator('body').innerText()).toLowerCase();

		expect(body).not.toMatch(/profit|loss\b|return on|portfolio|investment|roi/);
	});
});

test.describe('items with no current price', () => {
	test.use({ viewport: DESKTOP });

	test('still appear, with no invented comparison', async ({ page }) => {
		// AWP | Silk Tiger is the fixture's deliberately unpriced skin.
		await page.goto('/wishlist');
		await page.evaluate(
			(key) =>
				localStorage.setItem(
					key,
					JSON.stringify({
						version: 1,
						items: [
							{
								skinSlug: 'awp-silk-tiger',
								variant: { wear: 'Field-Tested' },
								addedAt: '2026-09-01T00:00:00.000Z',
								addedPriceMinor: 20_000,
								currency: 'BRL'
							}
						]
					})
				),
			STORAGE_KEY
		);

		await page.goto('/wishlist');

		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Silk Tiger');
		await expect(cards(page).first()).toContainText(
			/No current listings|Current price unavailable/
		);
		// No zero, and no comparison against nothing.
		await expect(cards(page).first().getByText('R$ 0,00')).toHaveCount(0);
		await expect(
			cards(page)
				.first()
				.getByText(/since added/)
		).toHaveCount(0);
	});
});

test.describe('removing and clearing', () => {
	test.use({ viewport: DESKTOP });

	async function saveTwo(page: Page) {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/skins/awp-asiimov?wear=Field-Tested');
		await ready(page);
		await saveButton(page).click();
	}

	test('removing one persists after a reload', async ({ page }) => {
		await saveTwo(page);
		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(2);

		await page.getByRole('button', { name: /^Remove AK-47 \| Redline$/ }).click();
		await expect(cards(page)).toHaveCount(1);

		await page.reload();
		await ready(page);

		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Asiimov');
	});

	test('clearing persists after a reload', async ({ page }) => {
		await saveTwo(page);
		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(2);

		await page.getByRole('button', { name: 'Clear wishlist' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Clear wishlist' }).click();

		await expect(page.getByText('Your wishlist is empty')).toBeVisible();
		expect(await stored(page)).toBeNull();

		await page.reload();
		await ready(page);

		await expect(page.getByText('Your wishlist is empty')).toBeVisible();
	});

	test('offers a way out of the empty state', async ({ page }) => {
		await page.goto('/wishlist');
		await ready(page);

		await expect(page.getByText('Your wishlist is empty')).toBeVisible();
		await page.getByRole('link', { name: 'Explore skins' }).click();

		await expect(page).toHaveURL('/explore');
	});
});

test.describe('what the wishlist costs', () => {
	test.use({ viewport: DESKTOP });

	test('one pricing request for the whole list, and no polling', async ({ page }) => {
		const resolves: string[] = [];

		page.on('request', (request) => {
			if (request.url().includes('/api/wishlist/resolve')) resolves.push(request.url());
		});

		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto(`${REDLINE}?wear=Minimal+Wear`);
		await ready(page);
		await saveButton(page).click();

		resolves.length = 0;

		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(2);

		// One request for both items, and it stays one.
		expect(resolves).toHaveLength(1);
		await page.waitForTimeout(2000);
		expect(resolves).toHaveLength(1);

		// And no refresh control pretending otherwise.
		await expect(page.getByRole('button', { name: /refresh|check prices/i })).toHaveCount(0);
	});

	test('removing one card does not re-price the rest', async ({ page }) => {
		const resolves: string[] = [];

		page.on('request', (request) => {
			if (request.url().includes('/api/wishlist/resolve')) resolves.push(request.url());
		});

		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();
		await page.goto('/skins/awp-asiimov?wear=Field-Tested');
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(2);
		resolves.length = 0;

		await page.getByRole('button', { name: /^Remove AK-47 \| Redline$/ }).click();
		await expect(cards(page)).toHaveCount(1);

		expect(resolves).toEqual([]);
	});

	test('renders no price history', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(1);

		// History belongs to the skin page.
		await expect(page.getByText(/Price history|30-day/)).toHaveCount(0);
	});
});

test.describe('discoverability and privacy', () => {
	test.use({ viewport: DESKTOP });

	test('is reachable from every page through the header', async ({ page }) => {
		await page.goto('/explore');
		await ready(page);

		const link = page.getByRole('link', { name: 'Wishlist' });

		await expect(link).toBeVisible();
		await link.click();

		await expect(page).toHaveURL('/wishlist');
	});

	test('says the list is local, and puts nothing of it in the metadata', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		const response = await page.goto('/wishlist');
		const html = (await response?.text()) ?? '';

		// The server rendering this page has never seen the list.
		expect(html).not.toContain('Redline');
		await expect(page.getByText('Saved on this device.')).toBeVisible();
	});
});

test.describe('the wishlist on mobile', () => {
	test.use({ viewport: MOBILE });

	test('stacks without horizontal overflow', async ({ page }) => {
		await page.goto(`${REDLINE}?wear=Field-Tested`);
		await ready(page);
		await saveButton(page).click();

		await page.goto('/wishlist');
		await expect(cards(page)).toHaveCount(1);

		const overflows = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(overflows).toBe(false);
	});

	test('keeps the header link reachable', async ({ page }) => {
		await page.goto('/explore');
		await ready(page);

		await expect(page.getByRole('link', { name: 'Wishlist' })).toBeVisible();
	});
});
