import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import SkinPage from './+page.svelte';
import { resolveVariant } from '$lib/features/skins/variant-selection';
import { readWishlist } from '$lib/features/wishlist';
import type { SkinRecommendation } from '$lib/features/recommendations/skin-recommendations';
import type { Skin, SkinVariant } from '$lib/types/skin';
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { PriceHistory } from '$lib/types/price-history';

// The page renders what its load gave it; the services have their own tests.
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/skins/ak-47-redline') }
}));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));
// LayerChart needs layout APIs jsdom does not have; the chart's own data
// handling is covered by the price-history tests.
vi.mock('layerchart', () => ({ AreaChart: (() => {}) as unknown }));

function variant(overrides: Partial<SkinVariant> & { itemId: number }): SkinVariant {
	return {
		marketHashName: `AK-47 | Redline (${overrides.wear ?? 'Field-Tested'})`,
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

const skin: Skin = {
	id: 'ak-47-redline',
	weapon: 'AK-47',
	name: 'Redline',
	fullName: 'AK-47 | Redline',
	imageUrl: 'https://cdn.example.test/redline.png',
	rarity: { name: 'Classified' },
	collection: 'The Phoenix Collection',
	weaponType: 'Assault Rifle',
	variants: [
		variant({ itemId: 10, wear: 'Minimal Wear', minFloat: 0.07, maxFloat: 0.15 }),
		variant({ itemId: 11, wear: 'Field-Tested' }),
		variant({ itemId: 20, wear: 'Field-Tested', statTrak: true })
	]
};

const providers: MarketProvider[] = [
	{ id: 'skinscom', name: 'Skins.com', marketType: 'P2P', status: 'up' },
	{ id: 'csfloat', name: 'CSFloat', marketType: 'P2P', status: 'up' }
];

function quote(providerId: string, priceMinor: number): MarketQuote {
	return {
		providerId,
		itemId: 11,
		priceMinor,
		currency: 'BRL',
		quantity: 105,
		updatedAt: new Date().toISOString(),
		stale: false,
		redirectUrl: `https://cs2c.app/r/${providerId}/11`
	};
}

const prices: SkinMarketPrices = {
	itemId: 11,
	currency: 'BRL',
	providersQueried: ['skinscom', 'csfloat'],
	quotes: [quote('skinscom', 12828), quote('csfloat', 12873)],
	bestQuote: quote('skinscom', 12828)
};

const history: PriceHistory = {
	itemId: 11,
	currency: 'BRL',
	interval: '1d',
	start: '2026-08-22T00:00:00Z',
	end: '2026-09-21T00:00:00Z',
	points: [
		{ timestamp: '2026-08-22T00:00:00.000Z', open: 13700, high: 13700, low: 13425, close: 13700 },
		{ timestamp: '2026-09-20T00:00:00.000Z', open: 12960, high: 12960, low: 12828, close: 12828 }
	]
};

/** A curated skin the recommendation service would hand back. */
function recommendation(
	weapon: string,
	name: string,
	slotId: string,
	overrides: Partial<SkinRecommendation> = {}
): SkinRecommendation {
	const slug = `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-');

	return {
		skin: {
			id: slug,
			weapon,
			name,
			fullName: `${weapon} | ${name}`,
			imageUrl: `https://cdn.example.test/${slug}.png`,
			rarity: { name: 'Classified' },
			variants: [],
			visual: { primaryColors: ['red'], secondaryColors: [], styles: ['dark'] }
		},
		variant: {
			itemId: 900,
			marketHashName: slug,
			wear: 'Factory New',
			statTrak: false,
			souvenir: false
		},
		slug,
		similarityScore: 6,
		matchedColors: ['red'],
		matchedStyles: ['dark'],
		slotId,
		...overrides
	};
}

const SIMILAR = [
	recommendation('AK-47', 'Bloodsport', 'ak-47'),
	recommendation('AK-47', 'Red Laminate', 'ak-47')
];

const MATCHES = [
	recommendation('USP-S', 'Check Engine', 'usp-s'),
	recommendation('AWP', 'Redline', 'awp'),
	recommendation('Karambit', 'Crimson Web', 'knife')
];

function props(overrides: Partial<Record<string, unknown>> = {}) {
	const selection = (overrides.selection as Record<string, unknown>) ?? {};
	const resolved = resolveVariant(skin, selection);

	return {
		data: {
			skin,
			variant: resolved,
			selection,
			prices,
			providers,
			history,
			recommendations: { similar: SIMILAR, matches: MATCHES },
			matcherSlot: undefined,
			...overrides
		},
		params: { slug: 'ak-47-redline' },
		form: null
	} as unknown as ComponentProps<typeof SkinPage>;
}

describe('skin identity', () => {
	it('names the grouped skin without repeating it', () => {
		render(SkinPage, { props: props() });

		expect(screen.getByRole('heading', { level: 1, name: 'Redline' })).toBeInTheDocument();
		expect(screen.getAllByText('AK-47').length).toBeGreaterThan(0);
	});

	it('shows the objective catalog facts', () => {
		render(SkinPage, { props: props() });

		const info = screen.getByRole('region', { name: 'Skin information' });
		expect(within(info).getByText('Assault Rifle')).toBeInTheDocument();
		expect(within(info).getByText('The Phoenix Collection')).toBeInTheDocument();
		expect(within(info).getByText('Classified')).toBeInTheDocument();
	});

	it('exposes no technical identifiers or float data', () => {
		const { container } = render(SkinPage, { props: props() });
		const text = container.textContent ?? '';

		// Note: "CSFloat" is a marketplace, not float data — check the values
		// and labels rather than the substring.
		for (const forbidden of [
			'0.07',
			'0.15',
			'Min float',
			'Max float',
			'marketHashName',
			'(Field-Tested)'
		]) {
			expect(text, forbidden).not.toContain(forbidden);
		}
	});

	it('offers a breadcrumb back to the weapon', () => {
		render(SkinPage, { props: props() });

		const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
		expect(within(crumbs).getByRole('link', { name: 'AK-47' })).toHaveAttribute(
			'href',
			'/explore?weapon=AK-47'
		);
	});
});

describe('variant selection', () => {
	it('defaults to the best plain variant', () => {
		render(SkinPage, { props: props() });

		// Redline has no Factory New, so Minimal Wear is the default.
		const exterior = screen.getByRole('group', { name: 'Exterior' });
		expect(within(exterior).getByRole('link', { name: 'Minimal Wear' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	it('honours an explicit selection from the URL', () => {
		render(SkinPage, {
			props: props({ selection: { wear: 'Field-Tested', edition: 'stattrak' } })
		});

		const edition = screen.getByRole('group', { name: 'Edition' });
		expect(within(edition).getByRole('link', { name: 'StatTrak' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	it('links each option to a shareable variant URL', () => {
		render(SkinPage, { props: props() });

		const exterior = screen.getByRole('group', { name: 'Exterior' });
		expect(within(exterior).getByRole('link', { name: 'Field-Tested' })).toHaveAttribute(
			'href',
			'/skins/ak-47-redline?wear=Field-Tested'
		);
	});

	it('offers no phase control for a skin without phases', () => {
		render(SkinPage, { props: props() });

		expect(screen.queryByRole('group', { name: 'Phase' })).toBeNull();
	});
});

describe('prices', () => {
	it('puts the best price first and names its marketplace', () => {
		render(SkinPage, { props: props() });

		const section = screen.getByRole('region', { name: 'Marketplace prices' });
		// The badge appears on the summary and again on the winning row.
		expect(within(section).getAllByText('Best price').length).toBeGreaterThan(0);
		expect(within(section).getAllByText(/128,28/).length).toBeGreaterThan(0);
		expect(within(section).getAllByText('Skins.com').length).toBeGreaterThan(0);
	});

	it('links out to the tracked offer in a new tab', () => {
		render(SkinPage, { props: props() });

		const offer = screen.getByRole('link', { name: /View offer/ });
		expect(offer).toHaveAttribute('href', 'https://cs2c.app/r/skinscom/11');
		expect(offer).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	it('does not show quantity', () => {
		const { container } = render(SkinPage, { props: props() });

		expect(container.textContent).not.toContain('105');
	});

	it('keeps the skin usable when prices fail', () => {
		render(SkinPage, { props: props({ prices: null }) });

		expect(screen.getByRole('heading', { level: 1, name: 'Redline' })).toBeInTheDocument();
		expect(screen.getByText('Prices are temporarily unavailable.')).toBeInTheDocument();
		// The failure says nothing about the upstream.
		expect(screen.queryByText(/CS2Cap|503/)).toBeNull();
	});

	it('still lists prices when the provider directory is empty', () => {
		render(SkinPage, { props: props({ providers: [] }) });

		const section = screen.getByRole('region', { name: 'Marketplace prices' });
		expect(within(section).getAllByText('skinscom').length).toBeGreaterThan(0);
		expect(within(section).getAllByText(/128,28/).length).toBeGreaterThan(0);
	});

	it('says so plainly when there are no quotes', () => {
		render(SkinPage, {
			props: props({
				prices: { ...prices, quotes: [], bestQuote: undefined }
			})
		});

		expect(screen.getByText('No current prices for this variant.')).toBeInTheDocument();
	});
});

describe('history', () => {
	it('keeps the comparison working when history fails', () => {
		render(SkinPage, { props: props({ history: null }) });

		expect(screen.getByText('Price history unavailable.')).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Marketplace prices' })).toBeInTheDocument();
	});
});

describe('metadata', () => {
	it('points the canonical URL at the product, not the variant', () => {
		render(SkinPage, { props: props({ selection: { wear: 'Field-Tested' } }) });

		const canonical = document.head.querySelector('link[rel="canonical"]');
		expect(canonical).toHaveAttribute('href', 'http://localhost/skins/ak-47-redline');
	});
});

describe('scope', () => {
	it('renders no controls for features that do not exist yet', () => {
		render(SkinPage, { props: props() });

		// The wishlist control is real now and has its own tests below. Price
		// alerts and watch lists are not, and must not be hinted at — there is
		// no account and nothing running in the background to honour them.
		expect(
			screen.queryByRole('button', { name: /alert|notify|watch|track price|favourite|favorite/i })
		).toBeNull();
	});
});

describe('recommendations', () => {
	function similarSection() {
		return screen.getByRole('region', { name: 'Similar skins' });
	}

	function matchesSection() {
		return screen.getByRole('region', { name: 'Matches this skin' });
	}

	it('shows other skins for the same weapon under Similar skins', () => {
		render(SkinPage, { props: props() });

		expect(within(similarSection()).getByText('Bloodsport')).toBeInTheDocument();
		expect(within(similarSection()).getByText('Red Laminate')).toBeInTheDocument();
	});

	it('names the weapon in the Similar subtitle', () => {
		render(SkinPage, { props: props() });

		expect(
			within(similarSection()).getByText('More AK-47 skins with a similar visual direction.')
		).toBeInTheDocument();
	});

	it('shows other slots under Matches this skin', () => {
		render(SkinPage, { props: props() });

		expect(within(matchesSection()).getByText('Check Engine')).toBeInTheDocument();
		expect(within(matchesSection()).getByText('Crimson Web')).toBeInTheDocument();
		expect(
			within(matchesSection()).getByText('Curated skins that pair with this look.')
		).toBeInTheDocument();
	});

	it('links every recommendation to the canonical product URL', () => {
		render(SkinPage, { props: props() });

		for (const section of [similarSection(), matchesSection()]) {
			for (const link of within(section).getAllByRole('link')) {
				// No wear, no edition: a recommendation is product-level
				// discovery, and the skin page picks its own default variant.
				expect(link.getAttribute('href')).toMatch(/^\/skins\/[a-z0-9-]+$/);
			}
		}
	});

	it('never recommends the skin being looked at', () => {
		render(SkinPage, { props: props() });

		for (const section of [similarSection(), matchesSection()]) {
			const hrefs = within(section)
				.getAllByRole('link')
				.map((link) => link.getAttribute('href'));

			expect(hrefs).not.toContain('/skins/ak-47-redline');
		}
	});

	it('shows no price on a recommendation card', () => {
		render(SkinPage, { props: props() });

		for (const section of [similarSection(), matchesSection()]) {
			// Not "Price unavailable" either: no price was requested, and
			// saying otherwise would claim we looked.
			expect(within(section).queryByText(/Price unavailable/i)).not.toBeInTheDocument();
			expect(within(section).queryByText(/R\$/)).not.toBeInTheDocument();
			expect(within(section).queryByText('From')).not.toBeInTheDocument();
		}
	});

	it('never shows a similarity score', () => {
		render(SkinPage, { props: props() });

		// The score ranks a short list; it is not a calibrated percentage and
		// is not a number anyone should read.
		for (const section of [similarSection(), matchesSection()]) {
			expect(section.textContent).not.toMatch(/\d+%|score|\b\d+ ?\/ ?\d+\b/i);
		}
	});

	it('omits both sections for an uncurated skin', () => {
		render(SkinPage, { props: props({ recommendations: { similar: [], matches: [] } }) });

		// No headings, and no empty boxes apologising for our curation backlog.
		expect(screen.queryByRole('region', { name: 'Similar skins' })).not.toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Matches this skin' })).not.toBeInTheDocument();
		expect(screen.queryByText(/don't understand this skin/i)).not.toBeInTheDocument();
	});

	it('omits one section without hiding the other', () => {
		render(SkinPage, { props: props({ recommendations: { similar: [], matches: MATCHES } }) });

		expect(screen.queryByRole('region', { name: 'Similar skins' })).not.toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Matches this skin' })).toBeInTheDocument();
	});

	it('keeps the price comparison rendering when recommendations are empty', () => {
		render(SkinPage, { props: props({ recommendations: { similar: [], matches: [] } }) });

		// The failure mode this guards: a recommendation bug taking the core
		// product down with it.
		expect(screen.getByRole('heading', { level: 1, name: 'Redline' })).toBeInTheDocument();
		expect(screen.getAllByText('R$ 128,28').length).toBeGreaterThan(0);
	});

	it('puts recommendations after the market data', () => {
		render(SkinPage, { props: props() });

		const headings = screen
			.getAllByRole('heading')
			.map((heading) => heading.textContent?.trim() ?? '');

		expect(headings.indexOf('Similar skins')).toBeGreaterThan(headings.indexOf('Price history'));
		expect(headings.indexOf('Matches this skin')).toBeGreaterThan(
			headings.indexOf('Similar skins')
		);
	});
});

describe('the Knife + Gloves matcher link', () => {
	function cta() {
		return screen.queryByRole('region', { name: /Find matching (gloves|knives)/ });
	}

	it('offers gloves for a curated knife', () => {
		render(SkinPage, { props: props({ matcherSlot: 'knife' }) });

		expect(within(cta()!).getByRole('link', { name: 'Find matching gloves' })).toBeInTheDocument();
	});

	it('offers knives for curated gloves', () => {
		render(SkinPage, { props: props({ matcherSlot: 'gloves' }) });

		expect(within(cta()!).getByRole('link', { name: 'Find matching knives' })).toBeInTheDocument();
	});

	it('stays away from a firearm', () => {
		// `matcherSlot` is only set for a knife or gloves; the loader decides.
		render(SkinPage, { props: props() });

		expect(cta()).not.toBeInTheDocument();
		expect(screen.queryByText(/Find matching/)).not.toBeInTheDocument();
	});

	it('stays away from an uncurated knife', () => {
		// Same absent prop, for the other reason: the matcher could only tell
		// them no, so there is no point sending them.
		render(SkinPage, { props: props({ matcherSlot: undefined }) });

		expect(cta()).not.toBeInTheDocument();
	});

	it('carries the exact variant on screen', () => {
		render(SkinPage, {
			props: props({ matcherSlot: 'knife', selection: { wear: 'Minimal Wear' } })
		});

		expect(within(cta()!).getByRole('link', { name: 'Find matching gloves' })).toHaveAttribute(
			'href',
			'/knife-gloves?skin=ak-47-redline&wear=Minimal%20Wear'
		);
	});

	it('sits below the market data, not beside it', () => {
		render(SkinPage, { props: props({ matcherSlot: 'knife' }) });

		const headings = screen
			.getAllByRole('heading')
			.map((heading) => heading.textContent?.trim() ?? '');

		expect(headings.indexOf('Find matching gloves')).toBeGreaterThan(
			headings.indexOf('Price history')
		);
	});
});

describe('the wishlist control', () => {
	function button() {
		return screen.getByRole('button', { name: /wishlist/i });
	}

	it('offers to save the skin being viewed', () => {
		render(SkinPage, { props: props() });

		expect(button()).toHaveTextContent('Add to wishlist');
	});

	it('sits below the variant selector, not beside the best price', () => {
		render(SkinPage, { props: props() });

		// Price comparison is what this page is for; a heart competing with
		// "View offer" would be fighting its own purpose.
		const prices = screen.getByRole('region', { name: 'Marketplace prices' });

		expect(prices.contains(button())).toBe(false);
	});

	it('saves the exact variant on screen', async () => {
		localStorage.clear();
		render(SkinPage, { props: props({ selection: { wear: 'Minimal Wear' } }) });

		await fireEvent.click(button());

		expect(readWishlist()).toMatchObject([
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Minimal Wear', edition: 'normal' } }
		]);
	});

	it('snapshots the best current price', async () => {
		localStorage.clear();
		render(SkinPage, { props: props() });

		await fireEvent.click(button());

		// The cheapest usable quote on the page: Skins.com at R$ 128,28.
		expect(readWishlist()[0]).toMatchObject({ addedPriceMinor: 12_828, currency: 'BRL' });
	});

	it('saves without a baseline when prices failed', async () => {
		localStorage.clear();
		render(SkinPage, { props: props({ prices: null }) });

		await fireEvent.click(button());

		expect(readWishlist()).toHaveLength(1);
		expect(readWishlist()[0].addedPriceMinor).toBeUndefined();
	});
});
