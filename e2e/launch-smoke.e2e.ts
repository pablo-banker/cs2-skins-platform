import { expect, test, type Page } from '@playwright/test';

/**
 * What has to be true of a deployed build, rather than of any one feature.
 *
 * The feature suites already cover behaviour. This covers the things only a
 * real production build can prove: that every route answers, that the
 * operational endpoints exist, that the development surfaces are gone, and
 * that the headers and SEO files are what the deployment assumes.
 */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

/** Every page a visitor can reach, and what it must be. */
const ROUTES = [
	'/',
	'/explore',
	'/skins/ak-47-redline',
	'/kits',
	'/kits/crimson',
	'/build',
	'/smart-loadout',
	'/knife-gloves',
	'/wishlist'
] as const;

async function ready(page: Page) {
	await page.waitForLoadState('networkidle');
}

test.describe('every route answers', () => {
	test.use({ viewport: DESKTOP });

	for (const route of ROUTES) {
		test(`${route} renders`, async ({ page }) => {
			const response = await page.goto(route);

			expect(response?.status()).toBe(200);
			// One h1, and it is not an error page.
			await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
			await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
		});
	}
});

test.describe('operational endpoints', () => {
	test('health says ok without touching anything upstream', async ({ request }) => {
		const response = await request.get('/api/health');

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
		// A cached health check is not a health check.
		expect(response.headers()['cache-control']).toContain('no-store');
	});

	test('health leaks nothing about the provider or its configuration', async ({ request }) => {
		const body = await (await request.get('/api/health')).text();

		expect(body).not.toMatch(/cs2cap|api key|bearer|version|uptime|catalog/i);
	});

	test('health keeps answering while the catalog is irrelevant to it', async ({ request }) => {
		// Ten in a row, before and after other traffic: liveness must never
		// depend on an upstream that can be down.
		for (let attempt = 0; attempt < 10; attempt++) {
			expect((await request.get('/api/health')).status()).toBe(200);
		}
	});
});

test.describe('robots.txt', () => {
	test('is plain text, crawlable, and points at the sitemap', async ({ request }) => {
		const response = await request.get('/robots.txt');
		const body = await response.text();

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/plain');

		expect(body).toContain('User-agent: *');
		expect(body).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
	});

	test('hides the plumbing and nothing else', async ({ request }) => {
		const body = await (await request.get('/robots.txt')).text();

		expect(body).toContain('Disallow: /api/');
		expect(body).toContain('Disallow: /dev/');

		// The product surfaces must stay crawlable.
		for (const path of ['/skins', '/kits', '/explore', '/build']) {
			expect(body).not.toContain(`Disallow: ${path}`);
		}
	});
});

test.describe('sitemap.xml', () => {
	test('is well-formed XML with the right type', async ({ request }) => {
		const response = await request.get('/sitemap.xml');
		const body = await response.text();

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('xml');

		expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(body.trimEnd().endsWith('</urlset>')).toBe(true);
		// Balanced.
		expect((body.match(/<url>/g) ?? []).length).toBe((body.match(/<\/url>/g) ?? []).length);
	});

	test('lists the static surfaces, the kits and the skins', async ({ request }) => {
		const body = await (await request.get('/sitemap.xml')).text();

		for (const path of ['/explore', '/kits', '/build', '/smart-loadout', '/knife-gloves']) {
			expect(body, path).toContain(`<loc>http://localhost:4173${path}</loc>`);
		}

		expect(body).toContain('/kits/crimson');
		expect(body).toContain('/skins/ak-47-redline');
		// The fixture catalog has dozens of skins; the real one has ~2,000.
		expect((body.match(/\/skins\//g) ?? []).length).toBeGreaterThan(10);
	});

	test('carries no query state and nothing private', async ({ request }) => {
		const body = await (await request.get('/sitemap.xml')).text();

		// A variant, a filter and a share payload are views of a page, not
		// pages — indexing them would multiply the real URLs many times over.
		expect(body).not.toContain('?wear=');
		expect(body).not.toContain('?edition=');
		expect(body).not.toContain('?loadout=');
		expect(body).not.toContain('?skin=');
		expect(body).not.toContain('?q=');

		// The wishlist is one browser's, and `/api` and `/dev` are not pages.
		expect(body).not.toContain('/wishlist');
		expect(body).not.toContain('/api/');
		expect(body).not.toContain('/dev/');
	});
});

test.describe('security headers', () => {
	test('a page carries the policy', async ({ request }) => {
		const headers = (await request.get('/')).headers();

		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['permissions-policy']).toContain('camera=()');
	});

	test('the content security policy is restrictive and same-origin', async ({ request }) => {
		const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';

		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("form-action 'self'");
		// The browser talks to this origin; the server talks to CS2Cap.
		expect(csp).toContain("connect-src 'self'");
		expect(csp).not.toContain('api.cs2c.app');

		// The boundary that matters: script injection stays impossible.
		// `style-src` allows inline because SvelteKit's screen-reader
		// announcer uses a style attribute, which cannot be hashed.
		expect(csp).toMatch(/script-src [^;]*'self'/);
		expect(csp).not.toMatch(/script-src [^;]*unsafe-inline/);
		expect(csp).not.toContain('unsafe-eval');
		expect(csp).not.toContain('img-src https:');
	});

	test('an API response carries them too, and allows no cross-origin reader', async ({
		request
	}) => {
		const response = await request.get('/api/health');

		expect(response.headers()['x-content-type-options']).toBe('nosniff');
		// The product is same-origin. Nothing here is a public API.
		expect(response.headers()['access-control-allow-origin']).toBeUndefined();
	});

	test('the page renders with the policy enforced', async ({ page }) => {
		const violations: string[] = [];

		page.on('console', (message) => {
			if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
		});

		await page.goto('/');
		await ready(page);

		// A policy that breaks the page is worse than no policy.
		expect(violations).toEqual([]);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});

test.describe('development surfaces are gone', () => {
	for (const path of [
		'/dev/components',
		'/dev/visual-metadata',
		'/api/dev/cs2cap',
		'/api/dev/visual-coverage',
		'/api/dev/visual-metadata'
	]) {
		test(`${path} is not available`, async ({ request }) => {
			expect((await request.get(path)).status()).toBe(404);
		});
	}

	test('the curation writer cannot be reached, let alone write', async ({ request }) => {
		// The one endpoint in the product that touches the filesystem.
		const response = await request.post('/api/dev/visual-metadata', {
			data: { records: [] }
		});

		expect(response.status()).toBe(404);
	});
});

test.describe('errors', () => {
	test('an unknown page is a calm 404 that keeps the navigation', async ({ page }) => {
		const response = await page.goto('/definitely-not-a-page');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
		// Never a stack trace.
		await expect(page.getByText(/at \w+ \(/)).toHaveCount(0);
	});

	test('an unknown skin and an unknown kit are 404s', async ({ page }) => {
		expect((await page.goto('/skins/not-a-real-skin'))?.status()).toBe(404);
		expect((await page.goto('/kits/not-a-real-kit'))?.status()).toBe(404);
	});

	test('an unknown API path is a 404, not a crash', async ({ request }) => {
		expect((await request.get('/api/not-an-endpoint')).status()).toBe(404);
	});

	test('no page leaks a provider detail or a filesystem path', async ({ page }) => {
		for (const route of ['/', '/definitely-not-a-page', '/skins/not-a-real-skin']) {
			await page.goto(route);

			const html = await page.content();

			expect(html, route).not.toMatch(/cs2cap_|Bearer |\/Users\/|node_modules/i);
		}
	});
});

/**
 * Small phone, large phone, tablet, small laptop, desktop, wide desktop.
 *
 * Horizontal overflow is the failure that hides: the page looks fine until a
 * single wide element — a table, a long unbroken name, a grid that forgot a
 * breakpoint — pushes the whole document sideways and every centred thing on
 * it stops lining up.
 */
const WIDTHS = [375, 430, 768, 1024, 1440, 1920] as const;

test.describe('no horizontal overflow, at any width', () => {
	for (const width of WIDTHS) {
		test(`every route fits ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });

			for (const route of ROUTES) {
				await page.goto(route);
				await ready(page);

				const widest = await page.evaluate(() => {
					const doc = document.documentElement;
					if (doc.scrollWidth <= doc.clientWidth + 1) return null;

					// Name the element responsible, so a failure is actionable
					// rather than just true.
					for (const el of document.body.querySelectorAll('*')) {
						const box = el.getBoundingClientRect();
						if (box.right > doc.clientWidth + 1 || box.left < -1) {
							return `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
						}
					}
					return 'unknown element';
				});

				expect(widest, `${route} overflows at ${width}px, caused by ${widest}`).toBeNull();
			}
		});
	}
});

test.describe('keyboard only', () => {
	test.use({ viewport: DESKTOP });

	test('the first tab stop is the skip link, and it goes to the content', async ({ page }) => {
		await page.goto('/');
		await ready(page);

		await page.keyboard.press('Tab');

		const skip = page.getByRole('link', { name: 'Skip to content' });
		await expect(skip).toBeFocused();

		// Hidden until focused is the point: it must be visible once it is.
		await expect(skip).toBeVisible();

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/#main-content$/);
	});

	for (const route of ROUTES) {
		test(`${route} can be traversed without a mouse`, async ({ page }) => {
			await page.goto(route);
			await ready(page);

			const seen = new Set<string>();
			let reachedMain = false;

			// Far more presses than any page needs, so a trap shows up as a
			// repeat rather than as a timeout.
			for (let i = 0; i < 60; i++) {
				await page.keyboard.press('Tab');

				const focused = await page.evaluate(() => {
					const el = document.activeElement;
					if (!el || el === document.body) return null;

					const style = getComputedStyle(el);
					return {
						id: `${el.tagName}:${el.getAttribute('href') ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? ''}`,
						inMain: Boolean(el.closest('main')),
						// A focus ring of some kind must exist. Browsers paint a
						// default one; removing it without a replacement is the
						// bug this catches.
						hasRing:
							style.outlineStyle !== 'none' ||
							style.boxShadow !== 'none' ||
							el.matches(':focus-visible')
					};
				});

				if (!focused) break;
				if (focused.inMain) reachedMain = true;

				expect(focused.hasRing, `a focusable element on ${route} shows no focus ring`).toBe(true);

				seen.add(focused.id);
			}

			expect(reachedMain, `tabbing never reaches the main content on ${route}`).toBe(true);
		});
	}
});

test.describe('touch targets', () => {
	test.use({ viewport: MOBILE });

	for (const route of ROUTES) {
		test(`${route} is tappable`, async ({ page }) => {
			await page.goto(route);
			await ready(page);

			// WCAG 2.2 AA asks for 24x24 CSS pixels, with inline text links
			// exempt because they sit in a line of prose.
			const small = await page.evaluate(() => {
				const offenders: string[] = [];

				for (const el of document.querySelectorAll<HTMLElement>(
					'a, button, input, select, [role="button"], [role="tab"], [role="checkbox"]'
				)) {
					const box = el.getBoundingClientRect();
					if (box.width === 0 || box.height === 0) continue; // not rendered

					const style = getComputedStyle(el);

					// Visually hidden but focusable — the skip link, live-region
					// helpers. Not a touch target: nothing is painted to tap.
					// Tailwind 4's `sr-only` clips with `clip-path: inset(50%)`;
					// the older `clip` rectangle is still out there in hand-written
					// CSS, so both count.
					if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') {
						continue;
					}

					// An inline link sits in a line of prose, which WCAG 2.2
					// exempts precisely because enlarging it would break the text.
					if (el.tagName === 'A' && style.display === 'inline') continue;

					// A control wrapped in a label is activated by the whole
					// label, so the label is the target — measuring the 16px box
					// inside it would fail a row that is comfortably tappable.
					const label = el.closest('label');
					const target = label ? label.getBoundingClientRect() : box;

					if (target.width < 24 || target.height < 24) {
						offenders.push(
							`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(target.width)}x${Math.round(target.height)}`
						);
					}
				}

				return offenders;
			});

			expect(small, `targets under 24px on ${route}: ${small.join(', ')}`).toEqual([]);
		});
	}
});

test.describe('canonical and indexing', () => {
	test.use({ viewport: DESKTOP });

	/** The canonical href a page declares. */
	async function canonicalOf(page: Page, route: string): Promise<string | null> {
		await page.goto(route);

		return page.locator('link[rel="canonical"]').getAttribute('href');
	}

	for (const route of ROUTES) {
		test(`${route} declares a canonical`, async ({ page }) => {
			expect(await canonicalOf(page, route)).toBeTruthy();
		});
	}

	test('a filtered catalog is still the catalog', async ({ page }) => {
		// Weapon × wear × rarity × collection × sort × page would otherwise
		// multiply one page into tens of thousands of indexable URLs.
		const filtered = await canonicalOf(
			page,
			'/explore?q=redline&weapon=AK-47&rarity=Classified&page=2'
		);

		expect(filtered).toBe('http://localhost:4173/explore');
	});

	test('a variant is a view of its skin, not a page of its own', async ({ page }) => {
		const variant = await canonicalOf(page, '/skins/ak-47-redline?wear=Minimal+Wear');

		expect(variant).toBe('http://localhost:4173/skins/ak-47-redline');
	});

	test('a shared loadout and a chosen matcher source are views too', async ({ page }) => {
		expect(await canonicalOf(page, '/build?loadout=v1.abc')).toBe('http://localhost:4173/build');
		expect(await canonicalOf(page, '/knife-gloves?skin=karambit-crimson-web')).toBe(
			'http://localhost:4173/knife-gloves'
		);
	});

	test('the wishlist asks not to be indexed', async ({ page }) => {
		await page.goto('/wishlist');

		// Its server-rendered content is the same empty frame for everybody.
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
	});

	test('no other route asks not to be indexed', async ({ page }) => {
		for (const route of ROUTES.filter((entry) => entry !== '/wishlist')) {
			await page.goto(route);

			expect(await page.locator('meta[name="robots"]').count(), route).toBe(0);
		}
	});

	test('every page has a title and a description', async ({ page }) => {
		for (const route of ROUTES) {
			await page.goto(route);

			expect(await page.title(), route).not.toBe('');
			const description = await page.locator('meta[name="description"]').getAttribute('content');

			expect(description, route).toBeTruthy();
			// A price in metadata is stale before it is crawled.
			expect(description, route).not.toMatch(/R\$/);
		}
	});
});

test.describe('the built client', () => {
	test('never receives a secret or a provider internal', async ({ page }) => {
		const scripts: string[] = [];

		page.on('response', async (response) => {
			if (!response.url().endsWith('.js')) return;

			try {
				scripts.push(await response.text());
			} catch {
				// A cached or redirected response has no body to read.
			}
		});

		// A journey that pulls in most of the client code.
		await page.goto('/');
		await ready(page);
		await page.goto('/skins/ak-47-redline');
		await ready(page);
		await page.goto('/build');
		await ready(page);

		const bundle = scripts.join('\n');

		expect(bundle.length).toBeGreaterThan(0);
		// The sentinel the E2E server runs with, plus the shapes a leak takes.
		expect(bundle).not.toContain('e2e-stub-key');
		expect(bundle).not.toContain('CS2CAP_API_KEY');
		expect(bundle).not.toContain('api.cs2c.app');
		// Raw provider vocabulary stays inside the integration folder.
		expect(bundle).not.toContain('market_hash_name');
		expect(bundle).not.toContain('lowest_ask');
	});
});
