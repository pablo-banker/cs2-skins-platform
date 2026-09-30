import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import MatcherPage from './+page.svelte';
import { decodeLoadout, SHARE_PARAM } from '$lib/features/loadout/share';
import type {
	KnifeGloveMatch,
	KnifeGloveSource,
	KnifeGloveSourceOption,
	KnifeGlovesResult
} from '$lib/types/knife-gloves';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/knife-gloves?skin=karambit-crimson-web') }
}));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

const OPTIONS: KnifeGloveSourceOption[] = [
	{ slug: 'karambit-crimson-web', slotId: 'knife', weapon: 'Karambit', name: 'Crimson Web' },
	{ slug: 'm9-bayonet-crimson-web', slotId: 'knife', weapon: 'M9 Bayonet', name: 'Crimson Web' },
	{
		slug: 'specialist-gloves-crimson-web',
		slotId: 'gloves',
		weapon: 'Specialist Gloves',
		name: 'Crimson Web'
	}
];

function source(overrides: Partial<KnifeGloveSource> = {}): KnifeGloveSource {
	return {
		slug: 'karambit-crimson-web',
		slotId: 'knife',
		weapon: 'Karambit',
		name: 'Crimson Web',
		fullName: 'Karambit | Crimson Web',
		imageUrl: 'https://cdn.example.test/karambit.png',
		rarity: { name: 'Covert' },
		variant: { wear: 'Field-Tested', edition: 'normal' },
		price: {
			amountMinor: 306_402,
			currency: 'BRL',
			providerId: 'csfloat',
			providerName: 'CSFloat'
		},
		wears: ['Factory New', 'Minimal Wear', 'Field-Tested'],
		...overrides
	};
}

function match(
	weapon: string,
	name: string,
	overrides: Partial<KnifeGloveMatch> = {}
): KnifeGloveMatch {
	const slug = `${weapon}-${name}`.toLowerCase().replaceAll(/\W+/g, '-');
	const price =
		overrides.price !== undefined
			? overrides.price
			: {
					amountMinor: 59_571,
					currency: 'BRL',
					providerId: 'csfloat',
					providerName: 'CSFloat'
				};

	return {
		slug,
		slotId: 'gloves',
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		imageUrl: `https://cdn.example.test/${slug}.png`,
		rarity: { name: 'Extraordinary' },
		variant: { wear: 'Field-Tested', edition: 'normal' },
		price,
		pairTotal: price ? { amountMinor: 306_402 + price.amountMinor, currency: 'BRL' } : null,
		pairSelections: [
			{
				slotId: 'knife',
				skinSlug: 'karambit-crimson-web',
				variant: { wear: 'Field-Tested', edition: 'normal' }
			},
			{ slotId: 'gloves', skinSlug: slug, variant: { wear: 'Field-Tested', edition: 'normal' } }
		],
		...overrides
	};
}

const READY: KnifeGlovesResult = {
	state: 'ready',
	source: source(),
	matches: [match('Specialist Gloves', 'Crimson Web'), match('Sport Gloves', 'Scarlet Shamagh')],
	pricesUnavailable: false
};

function props(result: KnifeGlovesResult = READY, catalogFailed = false) {
	return {
		data: { options: OPTIONS, result, catalogFailed },
		params: {},
		form: null
	} as unknown as ComponentProps<typeof MatcherPage>;
}

function results() {
	return screen.getByRole('region', { name: /^Matching (gloves|knives)$/ });
}

describe('the page itself', () => {
	it('has one h1', () => {
		render(MatcherPage, props());

		expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
		expect(
			screen.getByRole('heading', { level: 1, name: 'Knife + Gloves Matcher' })
		).toBeInTheDocument();
	});

	it('keeps the source and the prices out of the canonical URL', () => {
		render(MatcherPage, props());

		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
			'http://localhost/knife-gloves'
		);
		expect(
			document.head.querySelector('meta[name="description"]')?.getAttribute('content')
		).not.toMatch(/R\$|Karambit/);
	});
});

describe('with nothing selected', () => {
	it('invites a choice instead of rendering empty cards', () => {
		render(MatcherPage, props({ state: 'none' }));

		expect(screen.getByText('Choose a knife or gloves skin')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Choose skin/ })).toBeInTheDocument();
		expect(screen.queryByRole('region', { name: /^Matching/ })).not.toBeInTheDocument();
	});
});

describe('with a knife selected', () => {
	it('shows the source, named as a knife', () => {
		render(MatcherPage, props());

		const panel = screen.getByRole('region', { name: 'Your knife' });

		expect(within(panel).getByText('Karambit')).toBeInTheDocument();
		expect(within(panel).getByText('Crimson Web')).toBeInTheDocument();

		// The exterior appears twice — as the badge on the skin, and as the
		// selected option in the exterior control. This is the badge.
		const wearNodes = within(panel).getAllByText('Field-Tested');
		expect(wearNodes.some((node) => node.closest('a') === null)).toBe(true);
	});

	it('shows the source price and its marketplace', () => {
		render(MatcherPage, props());

		const panel = screen.getByRole('region', { name: 'Your knife' });

		expect(within(panel).getByText('R$ 3.064,02')).toBeInTheDocument();
		expect(within(panel).getByText('CSFloat')).toBeInTheDocument();
	});

	it('names the direction it is matching in', () => {
		render(MatcherPage, props());

		expect(screen.getByRole('heading', { name: 'Matching gloves' })).toBeInTheDocument();
	});

	it('lists each counterpart with its price and marketplace', () => {
		render(MatcherPage, props());

		const cards = within(results()).getAllByRole('listitem');

		expect(cards).toHaveLength(2);
		expect(within(cards[0]).getByText('Specialist Gloves')).toBeInTheDocument();
		expect(within(cards[0]).getByText('R$ 595,71')).toBeInTheDocument();
		expect(within(cards[0]).getByText('CSFloat')).toBeInTheDocument();
	});

	it('shows the pair total', () => {
		render(MatcherPage, props());

		const first = within(results()).getAllByRole('listitem')[0];

		expect(within(first).getByText('Pair total')).toBeInTheDocument();
		// 3.064,02 + 595,71, to the cent.
		expect(within(first).getByText('R$ 3.659,73')).toBeInTheDocument();
	});

	it('says once that a total spans marketplaces', () => {
		render(MatcherPage, props());

		expect(screen.getAllByText(/may be on different marketplaces/)).toHaveLength(1);
	});

	it('offers the source exterior as navigation', () => {
		render(MatcherPage, props());

		const selector = screen.getByRole('group', { name: 'Exterior' });
		const current = within(selector).getByRole('link', { name: 'Field-Tested' });

		expect(current).toHaveAttribute('aria-current', 'true');
		expect(within(selector).getByRole('link', { name: 'Factory New' })).toHaveAttribute(
			'href',
			'?skin=karambit-crimson-web&wear=Factory%20New'
		);
	});

	it('hides the exterior selector for a skin with one exterior', () => {
		render(MatcherPage, props({ ...READY, source: source({ wears: [] }) }));

		expect(screen.queryByRole('group', { name: 'Exterior' })).not.toBeInTheDocument();
	});
});

describe('with gloves selected', () => {
	const asGloves: KnifeGlovesResult = {
		state: 'ready',
		source: source({
			slug: 'specialist-gloves-crimson-web',
			slotId: 'gloves',
			weapon: 'Specialist Gloves',
			fullName: 'Specialist Gloves | Crimson Web'
		}),
		matches: [match('Karambit', 'Crimson Web', { slotId: 'knife' })],
		pricesUnavailable: false
	};

	it('names the source as gloves and matches knives', () => {
		render(MatcherPage, props(asGloves));

		expect(screen.getByRole('region', { name: 'Your gloves' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Matching knives' })).toBeInTheDocument();
	});
});

describe('links out', () => {
	it('opens each counterpart at the exact variant priced', () => {
		render(MatcherPage, props());

		const first = within(results()).getAllByRole('listitem')[0];

		expect(within(first).getByRole('link', { name: /^View Crimson Web$/ })).toHaveAttribute(
			'href',
			'/skins/specialist-gloves-crimson-web?wear=Field-Tested'
		);
	});

	it('opens the source at the exact variant shown', () => {
		render(MatcherPage, props({ ...READY, source: source({ variant: { wear: 'Factory New' } }) }));

		expect(screen.getByRole('link', { name: /View Crimson Web details/ })).toHaveAttribute(
			'href',
			'/skins/karambit-crimson-web?wear=Factory%20New'
		);
	});

	it('hands the pair to the builder as an ordinary share link', () => {
		render(MatcherPage, props());

		const first = within(results()).getAllByRole('listitem')[0];
		const link = within(first).getByRole('link', { name: /Open pair in Builder/ });
		const href = link.getAttribute('href') ?? '';

		expect(href).toContain('/build?');

		const payload = new URL(href, 'http://localhost').searchParams.get(SHARE_PARAM) ?? '';
		const decoded = decodeLoadout(payload);

		expect(decoded.ok).toBe(true);
		expect(decoded.ok && decoded.selections).toEqual([
			{
				slotId: 'knife',
				skinSlug: 'karambit-crimson-web',
				variant: { wear: 'Field-Tested', edition: 'normal' }
			},
			{
				slotId: 'gloves',
				skinSlug: 'specialist-gloves-crimson-web',
				variant: { wear: 'Field-Tested', edition: 'normal' }
			}
		]);
	});

	it('gives each repeated builder link a distinct accessible name', () => {
		render(MatcherPage, props());

		const names = within(results())
			.getAllByRole('link', { name: /Open pair in Builder/ })
			.map((link) => link.textContent?.replace(/\s+/g, ' ').trim());

		expect(new Set(names).size).toBe(names.length);
		expect(names[0]).toContain('Specialist Gloves | Crimson Web');
	});
});

describe('when prices are missing', () => {
	it('says so per item rather than hiding the match', () => {
		render(
			MatcherPage,
			props({
				...READY,
				matches: [match('Specialist Gloves', 'Crimson Web', { price: null, pairTotal: null })]
			})
		);

		const first = within(results()).getAllByRole('listitem')[0];

		expect(within(first).getByText('Specialist Gloves')).toBeInTheDocument();
		expect(within(first).getByText('Price temporarily unavailable')).toBeInTheDocument();
	});

	it('shows no half-total', () => {
		render(
			MatcherPage,
			props({
				...READY,
				matches: [match('Specialist Gloves', 'Crimson Web', { price: null, pairTotal: null })]
			})
		);

		const first = within(results()).getAllByRole('listitem')[0];

		expect(within(first).getByText('Pair total')).toBeInTheDocument();
		expect(within(first).getByText('Unavailable')).toBeInTheDocument();
		expect(within(first).queryByText(/R\$/)).not.toBeInTheDocument();
	});

	it('keeps the visual matches when the whole market is down', () => {
		render(
			MatcherPage,
			props({
				state: 'ready',
				source: source({ price: null }),
				matches: [match('Specialist Gloves', 'Crimson Web', { price: null, pairTotal: null })],
				pricesUnavailable: true
			})
		);

		expect(
			screen.getByText(/Current marketplace prices are temporarily unavailable/)
		).toBeInTheDocument();
		expect(within(results()).getAllByRole('listitem')).toHaveLength(1);
	});
});

describe('states someone can recover from', () => {
	it('recovers from an unknown skin', () => {
		render(MatcherPage, props({ state: 'unknown-skin' }));

		expect(screen.getByText('This skin could not be loaded')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Choose skin/ })).toBeInTheDocument();
	});

	it('recovers from a firearm', () => {
		render(MatcherPage, props({ state: 'wrong-category' }));

		expect(screen.getByText('This matcher works on knives and gloves')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Choose skin/ })).toBeInTheDocument();
	});

	it('names an uncurated skin and offers another', () => {
		render(MatcherPage, props({ state: 'uncurated', fullName: 'Karambit | Doppler' }));

		expect(
			screen.getByText(/Karambit \| Doppler isn't in our curated matching collection yet/)
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Choose skin/ })).toBeInTheDocument();
	});

	it('says so when nothing matches, without lowering the bar', () => {
		render(MatcherPage, props({ ...READY, matches: [] }));

		expect(screen.getByText('No strong curated matches yet.')).toBeInTheDocument();
		expect(within(results()).queryAllByRole('listitem')).toHaveLength(0);
		// The source is still there to change.
		expect(screen.getByRole('region', { name: 'Your knife' })).toBeInTheDocument();
	});

	it('survives the catalog being down', () => {
		render(MatcherPage, props({ state: 'none' }, true));

		expect(screen.getByText(/The catalog is temporarily unavailable/)).toBeInTheDocument();
	});
});

describe('what it never says', () => {
	it('makes no perfection claim', () => {
		render(MatcherPage, props());

		const text = document.body.textContent ?? '';

		expect(text).not.toMatch(/perfect match|guaranteed|best combination|every knife/i);
	});

	it('shows no similarity score', () => {
		render(MatcherPage, props());

		expect(within(results()).queryByText(/\d+%|score/i)).not.toBeInTheDocument();
	});
});
