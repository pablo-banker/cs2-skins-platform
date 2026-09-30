import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import KitPage from './+page.svelte';
import { STEAM_PROVIDER_ID } from '$lib/features/kits/purchase-strategy';
import type { ResolvedKit, ResolvedKitItem } from '$lib/types/kit';
import type { MarketQuote, SkinMarketPrices } from '$lib/types/market';
import type { MarketProvider } from '$lib/types/provider';
import type { Skin, SkinVariant } from '$lib/types/skin';

// The page renders what its load gave it; the services have their own tests.
vi.mock('$app/state', () => ({
	page: { url: new URL('https://cs2skins.test/kits/midnight') }
}));

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested'];

/**
 * A resolved kit item carries the **complete** catalog skin alongside the one
 * variant the kit chose — that is what the service returns, and the item links
 * need the full variant list to know whether a wear is worth putting in a URL.
 */
function item(
	weapon: string,
	name: string,
	itemId: number,
	wear = 'Field-Tested'
): ResolvedKitItem {
	const slug = `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-');

	const variants: SkinVariant[] = WEARS.map((exterior, index) => ({
		itemId: itemId * 10 + index,
		marketHashName: `${weapon} | ${name} (${exterior})`,
		wear: exterior,
		statTrak: false,
		souvenir: false
	}));

	const skin: Skin = {
		id: slug,
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		imageUrl: `https://cdn.example.test/${slug}.png`,
		rarity: { name: 'Mil-Spec Grade' },
		variants
	};

	return { skin, variant: variants.find((candidate) => candidate.wear === wear) ?? variants[0] };
}

const ITEMS = [
	item('AK-47', 'Black Laminate', 1),
	item('AWP', 'Graphite', 2, 'Minimal Wear'),
	item('M4A1-S', 'Basilisk', 3)
];

function kit(overrides: Partial<ResolvedKit> = {}): ResolvedKit {
	return {
		slug: 'midnight',
		name: 'Midnight',
		description: 'Matte, near-black finishes for a loadout that stays quiet.',
		category: 'style',
		tags: ['dark', 'minimal', 'black'],
		items: ITEMS,
		...overrides
	};
}

function quote(providerId: string, priceMinor: number, itemId: number): MarketQuote {
	return {
		providerId,
		itemId,
		priceMinor,
		currency: 'BRL',
		quantity: 5,
		stale: false,
		redirectUrl: `https://cs2c.app/r/${providerId}/${itemId}`
	};
}

function pricesFor(itemId: number, offers: [string, number][]): SkinMarketPrices {
	const quotes = offers
		.map(([providerId, priceMinor]) => quote(providerId, priceMinor, itemId))
		.sort((a, b) => a.priceMinor - b.priceMinor);

	return {
		itemId,
		currency: 'BRL',
		providersQueried: offers.map(([providerId]) => providerId),
		quotes,
		bestQuote: quotes[0]
	};
}

const PROVIDERS: MarketProvider[] = [
	{ id: 'csfloat', name: 'CSFloat', marketType: 'P2P', status: 'up' },
	{ id: STEAM_PROVIDER_ID, name: 'Steam', marketType: 'OFFICIAL', status: 'up' }
];

/** Fully priced: CSFloat cheapest on every item, Steam quoting all of them. */
function fullPrices(): [number, SkinMarketPrices | null][] {
	return [
		[
			ITEMS[0].variant.itemId,
			pricesFor(ITEMS[0].variant.itemId, [
				['csfloat', 10000],
				[STEAM_PROVIDER_ID, 12000]
			])
		],
		[
			ITEMS[1].variant.itemId,
			pricesFor(ITEMS[1].variant.itemId, [
				['csfloat', 20000],
				[STEAM_PROVIDER_ID, 25000]
			])
		],
		[
			ITEMS[2].variant.itemId,
			pricesFor(ITEMS[2].variant.itemId, [
				['csfloat', 30000],
				[STEAM_PROVIDER_ID, 33000]
			])
		]
	];
}

function props(
	overrides: {
		kit?: ResolvedKit;
		prices?: [number, SkinMarketPrices | null][];
		providers?: MarketProvider[];
	} = {}
) {
	return {
		data: {
			kit: overrides.kit ?? kit(),
			prices: overrides.prices ?? fullPrices(),
			providers: overrides.providers ?? PROVIDERS
		},
		params: { slug: 'midnight' },
		form: null
	} as unknown as ComponentProps<typeof KitPage>;
}

/** The breadcrumb is a list too; the item list is the one inside the section. */
function includedSkins(): HTMLElement {
	return within(screen.getByRole('region', { name: 'Included skins' })).getByRole('list');
}

describe('Kit page identity', () => {
	it('leads with the kit name, description and direction', () => {
		render(KitPage, { props: props() });

		expect(screen.getByRole('heading', { level: 1, name: 'Midnight' })).toBeInTheDocument();
		expect(
			screen.getByText('Matte, near-black finishes for a loadout that stays quiet.')
		).toBeInTheDocument();
		expect(screen.getByText('Dark · Minimal · Black · 3 skins')).toBeInTheDocument();
	});

	it('offers a breadcrumb back to the catalog', () => {
		render(KitPage, { props: props() });

		const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

		expect(within(breadcrumb).getByRole('link', { name: 'Kits' })).toHaveAttribute('href', '/kits');
		expect(within(breadcrumb).getByText('Midnight')).toHaveAttribute('aria-current', 'page');
	});

	it('lists every skin, linked at the exterior the kit intends', () => {
		render(KitPage, { props: props() });

		const links = within(includedSkins()).getAllByRole('link');

		expect(within(includedSkins()).getAllByRole('listitem')).toHaveLength(3);
		expect(links[0]).toHaveAttribute('href', '/skins/ak-47-black-laminate?wear=Field-Tested');
		expect(links[1]).toHaveAttribute('href', '/skins/awp-graphite?wear=Minimal%20Wear');
	});
});

describe('Kit totals', () => {
	it('shows the lowest-price total for the whole kit', () => {
		render(KitPage, { props: props() });

		// 100.00 + 200.00 + 300.00
		expect(screen.getAllByText('R$ 600,00').length).toBeGreaterThan(0);
		expect(screen.getByText('Lowest price')).toBeInTheDocument();
	});

	it('shows a Steam total and the exact difference when Steam quotes everything', () => {
		render(KitPage, { props: props() });

		expect(screen.getByText('Steam total')).toBeInTheDocument();
		expect(screen.getByText('R$ 700,00')).toBeInTheDocument();
		expect(screen.getByText('R$ 100,00 lower than Steam')).toBeInTheDocument();
	});

	it('omits the Steam comparison when Steam is missing one item', () => {
		const prices = fullPrices();
		prices[1] = [ITEMS[1].variant.itemId, pricesFor(ITEMS[1].variant.itemId, [['csfloat', 20000]])];

		render(KitPage, { props: props({ prices }) });

		expect(screen.queryByText('Steam total')).toBeNull();
		expect(screen.queryByText(/lower than Steam/)).toBeNull();
		// The kit total itself is unaffected.
		expect(screen.getAllByText('R$ 600,00').length).toBeGreaterThan(0);
	});

	it('carries no price into the page metadata', () => {
		const { container } = render(KitPage, { props: props() });

		expect(container.querySelector('title')?.textContent ?? '').not.toMatch(/R\$/);
	});
});

describe('Kit per-item price states', () => {
	it('shows each item’s cheapest price and where it is', () => {
		render(KitPage, { props: props() });

		const list = includedSkins();

		expect(within(list).getByText('R$ 100,00')).toBeInTheDocument();
		expect(within(list).getAllByText('CSFloat').length).toBe(3);
	});

	it('says "No current prices" for an item that loaded with nothing listed', () => {
		const prices = fullPrices();
		prices[1] = [ITEMS[1].variant.itemId, pricesFor(ITEMS[1].variant.itemId, [])];

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByText('No current prices')).toBeInTheDocument();
		expect(screen.queryByText('Price temporarily unavailable')).toBeNull();
	});

	it('says "Price temporarily unavailable" for an item whose request failed', () => {
		const prices = fullPrices();
		prices[1] = [ITEMS[1].variant.itemId, null];

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByText('Price temporarily unavailable')).toBeInTheDocument();
		expect(screen.queryByText('No current prices')).toBeNull();
	});

	it('still shows the prices it does have when one item is missing', () => {
		const prices = fullPrices();
		prices[1] = [ITEMS[1].variant.itemId, null];

		render(KitPage, { props: props({ prices }) });

		const list = includedSkins();

		expect(within(list).getByText('R$ 100,00')).toBeInTheDocument();
		expect(within(list).getByText('R$ 300,00')).toBeInTheDocument();
	});
});

describe('Kit incomplete pricing', () => {
	it('shows no total at all when one item has no price', () => {
		const prices = fullPrices();
		prices[1] = [ITEMS[1].variant.itemId, null];

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByText('Total unavailable')).toBeInTheDocument();
		expect(screen.getByText('1 item has no current price.')).toBeInTheDocument();
		// A subtotal of the remaining two would look exactly like a full total.
		expect(screen.queryByText('R$ 400,00')).toBeNull();
	});

	it('withholds the purchase plan and says how much is missing', () => {
		const prices = fullPrices();
		prices[0] = [ITEMS[0].variant.itemId, null];
		prices[1] = [ITEMS[1].variant.itemId, null];

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByText('Purchase plan unavailable')).toBeInTheDocument();
		expect(screen.getByText('Current pricing is missing for 2 of 3 items.')).toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'Lowest price' })).toBeNull();
	});

	it('keeps the kit identity when the whole market load failed', () => {
		const prices: [number, SkinMarketPrices | null][] = ITEMS.map((entry) => [
			entry.variant.itemId,
			null
		]);

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByRole('heading', { level: 1, name: 'Midnight' })).toBeInTheDocument();
		expect(includedSkins().querySelectorAll('li')).toHaveLength(3);
		expect(screen.getByText('Total unavailable')).toBeInTheDocument();
	});
});

describe('Kit purchase plan', () => {
	it('shows the plan total and marketplace count', () => {
		render(KitPage, { props: props() });

		const plan = screen.getByRole('region', { name: 'Purchase plan' });

		expect(within(plan).getByText('Total')).toBeInTheDocument();
		expect(within(plan).getByText('Marketplaces')).toBeInTheDocument();
	});

	it('groups the plan by marketplace, with a subtotal per marketplace', () => {
		render(KitPage, { props: props() });

		const group = screen.getByRole('region', { name: 'Buy from CSFloat' });

		expect(within(group).getAllByRole('listitem')).toHaveLength(3);
		expect(within(group).getByText('Subtotal')).toBeInTheDocument();
		expect(within(group).getByText('R$ 600,00')).toBeInTheDocument();
	});

	it('links each line to its own tracked offer', () => {
		render(KitPage, { props: props() });

		const group = screen.getByRole('region', { name: 'Buy from CSFloat' });
		const offer = within(group).getAllByRole('link')[0];

		// The AK's Field-Tested variant, which is the one the kit names.
		expect(offer).toHaveAttribute('href', `https://cs2c.app/r/csfloat/${ITEMS[0].variant.itemId}`);
		expect(offer).toHaveAttribute('target', '_blank');
		expect(offer.getAttribute('rel')).toContain('noopener');
	});

	it('renders no offer link for a quote that carries none', () => {
		// Batch responses carry no redirect; a fabricated marketplace URL would
		// be worse than no button.
		const prices = fullPrices();
		const [itemId, entry] = prices[0];
		const quotes = entry!.quotes.map((candidate) => ({ ...candidate, redirectUrl: undefined }));
		prices[0] = [itemId, { ...entry!, quotes, bestQuote: quotes[0] }];

		render(KitPage, { props: props({ prices }) });

		const group = screen.getByRole('region', { name: 'Buy from CSFloat' });

		expect(within(group).getAllByRole('link')).toHaveLength(2);
	});

	it('presents one plan when both strategies agree', () => {
		// CSFloat is cheapest everywhere and covers everything, so there is no
		// choice to offer.
		render(KitPage, { props: props() });

		expect(
			screen.getByText('The lowest-price plan already uses the fewest marketplaces.')
		).toBeInTheDocument();
		expect(screen.queryByRole('tab')).toBeNull();
	});

	it('offers both strategies when they differ', () => {
		const prices = fullPrices();
		// Steam is now cheapest on the middle item, so lowest-price needs two
		// marketplaces while fewer-marketplaces stays on one.
		prices[1] = [
			ITEMS[1].variant.itemId,
			pricesFor(ITEMS[1].variant.itemId, [
				['csfloat', 20000],
				[STEAM_PROVIDER_ID, 18000]
			])
		];

		render(KitPage, { props: props({ prices }) });

		expect(screen.getByRole('tab', { name: 'Fewer marketplaces' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Lowest price' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	it('states the difference between the strategies as fact, without recommending', () => {
		const prices = fullPrices();
		prices[1] = [
			ITEMS[1].variant.itemId,
			pricesFor(ITEMS[1].variant.itemId, [
				['csfloat', 20000],
				[STEAM_PROVIDER_ID, 18000]
			])
		];

		const { container } = render(KitPage, { props: props({ prices }) });

		expect(screen.getByText(/Fewer marketplaces costs/)).toBeInTheDocument();
		expect(container.textContent).not.toMatch(/recommend|you should|best choice|best value/i);
	});

	it('explains that checkout prices may differ, once', () => {
		const { container } = render(KitPage, { props: props() });

		const disclaimers = [...container.querySelectorAll('p')].filter((node) =>
			node.textContent?.includes('Final checkout prices may differ')
		);

		expect(disclaimers).toHaveLength(1);
	});

	it('makes no claim about fees', () => {
		const { container } = render(KitPage, { props: props() });

		expect(container.textContent).not.toMatch(
			/buyer fee|seller fee|withdrawal|cashout|after fees|tax/i
		);
	});

	it('offers no bulk "open all" control', () => {
		const { container } = render(KitPage, { props: props() });

		expect(container.textContent).not.toMatch(/open all|buy all/i);
	});
});

describe('Kit provider directory failure', () => {
	it('still prices and groups the kit using provider keys', () => {
		render(KitPage, { props: props({ providers: [] }) });

		expect(screen.getAllByText('R$ 600,00').length).toBeGreaterThan(0);
		expect(screen.getByRole('region', { name: 'Buy from csfloat' })).toBeInTheDocument();
	});
});

describe('Kit market boundaries', () => {
	it('loads no price history', () => {
		// History is the skin page's job; a kit needs current prices only.
		const loader = readFileSync('src/routes/kits/[slug]/+page.server.ts', 'utf8');

		expect(loader).not.toContain('getSkinPriceHistory');
		expect(loader).not.toContain('PriceHistory');
	});

	it('asks for prices once, for the whole kit, and for the directory once', () => {
		const loader = readFileSync('src/routes/kits/[slug]/+page.server.ts', 'utf8');

		expect(loader).toContain('getManySkinPrices');
		// Not one request per item, and not one provider lookup per item.
		expect(loader).not.toContain('getSkinPrices(');
		expect(loader.match(/getMarketProviders\(/g)).toHaveLength(1);
	});
});
