import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/svelte';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import { mount, unmount } from 'svelte';
import HomePage from './+page.svelte';
import type { ResolvedKit, ResolvedKitItem } from '$lib/types/kit';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

function kitItem(index: number): ResolvedKitItem {
	return {
		skin: {
			id: `skin-${index}`,
			weapon: 'AK-47',
			name: `Finish ${index}`,
			fullName: `AK-47 | Finish ${index}`,
			imageUrl: `https://cdn.example.test/${index}.png`,
			variants: []
		},
		variant: {
			itemId: index,
			marketHashName: `AK-47 | Finish ${index} (Field-Tested)`,
			wear: 'Field-Tested',
			statTrak: false,
			souvenir: false
		}
	};
}

function kit(slug: string, name: string): ResolvedKit {
	return {
		slug,
		name,
		description: `What ${name} is about.`,
		category: 'color',
		tags: ['red', 'black'],
		items: [1, 2, 3, 4, 5].map(kitItem)
	};
}

const KITS = [kit('crimson', 'Crimson'), kit('monochrome', 'Monochrome'), kit('cobalt', 'Cobalt')];

let mounted: { component: Record<string, unknown>; target: HTMLElement } | undefined;

/**
 * Renders the homepage under a query client, as the root layout does.
 *
 * The hero search uses TanStack Query, so the page cannot mount without a
 * provider above it. A snippet is the only way to nest a component under one
 * from a test — the same approach the builder's page spec uses.
 */
function renderHome(kits: ResolvedKit[] = KITS) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const target = document.createElement('div');
	document.body.append(target);

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const child = (anchor: any) =>
		(HomePage as any)(anchor, { data: { kits }, params: {}, form: null });
	/* eslint-enable @typescript-eslint/no-explicit-any */

	const component = mount(QueryClientProvider, {
		target,
		props: { client, children: child as never }
	});

	mounted = { component: component as Record<string, unknown>, target };

	return target;
}

afterEach(() => {
	if (!mounted) return;

	unmount(mounted.component);
	mounted.target.remove();
	document.body.replaceChildren();
	mounted = undefined;
});

describe('the hero', () => {
	it('has exactly one h1, and it says what the product does', () => {
		renderHome();

		const headings = screen.getAllByRole('heading', { level: 1 });

		expect(headings).toHaveLength(1);
		expect(headings[0]).toHaveTextContent(/Find the right CS2 skin/);
	});

	it('explains the product in a sentence', () => {
		renderHome();

		expect(screen.getByText(/Compare what every marketplace is asking/)).toBeInTheDocument();
	});

	it('offers a search field and two ways in', () => {
		renderHome();

		expect(screen.getByLabelText('Search for a skin')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Explore skins' })).toHaveAttribute('href', '/explore');
		expect(screen.getByRole('link', { name: 'Build a loadout' })).toHaveAttribute('href', '/build');
	});

	it('says plainly that we do not sell skins', () => {
		renderHome();

		expect(screen.getByText(/We don't sell skins/)).toBeInTheDocument();
	});
});

describe('where to start', () => {
	it('links every built product surface', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Where to start' });

		for (const [name, href] of [
			['Compare prices', '/explore'],
			['Build a loadout', '/build'],
			['Smart Loadout', '/smart-loadout'],
			['Curated kits', '/kits']
		]) {
			expect(within(section).getByRole('link', { name: new RegExp(name) })).toHaveAttribute(
				'href',
				href
			);
		}
	});

	it('gives each one a heading and a sentence', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Where to start' });

		expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(4);
	});
});

describe('the feature sections', () => {
	it('sends Smart Loadout its own entry point, and says it is curated', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Build around your budget' });

		expect(within(section).getByText(/curated skins/)).toBeInTheDocument();
		expect(within(section).getByRole('link', { name: 'Build a Smart Loadout' })).toHaveAttribute(
			'href',
			'/smart-loadout'
		);
	});

	it('sends the knife and gloves matcher its own entry point', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Match knives and gloves' });

		expect(within(section).getByRole('link', { name: 'Find a pairing' })).toHaveAttribute(
			'href',
			'/knife-gloves'
		);
	});

	it('mentions the wishlist without dedicating the page to it', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Keep an eye on what you want' });

		expect(within(section).getByRole('link', { name: 'View your wishlist' })).toHaveAttribute(
			'href',
			'/wishlist'
		);
		expect(within(section).getByText(/no account to make/)).toBeInTheDocument();
	});
});

describe('the kits preview', () => {
	it('shows the kits it was given, in editorial order', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Curated kits' });
		const names = within(section)
			.getAllByRole('heading', { level: 3 })
			.map((heading) => heading.textContent);

		expect(names).toEqual(['Crimson', 'Monochrome', 'Cobalt']);
	});

	it('links each kit and offers the rest', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Curated kits' });

		expect(within(section).getByRole('link', { name: /Crimson/ })).toHaveAttribute(
			'href',
			'/kits/crimson'
		);
		expect(within(section).getByRole('link', { name: 'View all kits' })).toHaveAttribute(
			'href',
			'/kits'
		);
	});

	it('shows no price on a kit', () => {
		renderHome();

		const section = screen.getByRole('region', { name: 'Curated kits' });

		// Kits carry no price anywhere, which is what keeps this preview free.
		expect(within(section).queryByText(/R\$/)).not.toBeInTheDocument();
		expect(within(section).queryByText(/Price unavailable/)).not.toBeInTheDocument();
	});

	it('disappears rather than showing an empty shelf', () => {
		renderHome([]);

		// The catalog being down costs the preview, not the homepage.
		expect(screen.queryByRole('region', { name: 'Curated kits' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Where to start' })).toBeInTheDocument();
	});
});

describe('metadata', () => {
	it('is product-oriented and canonical', () => {
		renderHome();

		expect(document.title).toContain('Compare Prices, Build Loadouts');
		expect(
			document.head.querySelector('meta[name="description"]')?.getAttribute('content')
		).toMatch(/Compare CS2 skin prices across marketplaces/);
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
			'http://localhost/'
		);
	});
});

describe('what the homepage never claims', () => {
	it('invents no popularity, trending or social proof', () => {
		renderHome();

		const text = document.body.textContent ?? '';

		// None of these have data behind them, and analytics are out of scope.
		expect(text).not.toMatch(/trending|most popular|most searched|users|trusted by|★/i);
	});

	it('offers no account or paid tier', () => {
		renderHome();

		const text = document.body.textContent ?? '';

		expect(text).not.toMatch(/sign up|log in|create account|premium|upgrade|pro plan/i);
	});

	it('shows no prices anywhere', () => {
		renderHome();

		expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
	});
});
