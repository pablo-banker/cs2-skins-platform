import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import ExplorePage from './+page.svelte';
import { parseExploreQuery } from '$lib/schemas/explore';
import { pickRepresentativeVariant } from '$lib/features/skins/representative-variant';
import type { Skin } from '$lib/types/skin';

// The page is presentational over its `data`; the service layer is exercised
// by its own tests and never reached from here.
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/explore') },
	navigating: { to: null }
}));

function skin(weapon: string, name: string, itemId: number): Skin {
	return {
		id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		rarity: { name: 'Covert' },
		variants: [
			{
				itemId,
				marketHashName: `${weapon} | ${name} (Field-Tested)`,
				wear: 'Field-Tested',
				statTrak: false,
				souvenir: false
			}
		]
	};
}

const options = {
	weapons: ['AK-47', 'AWP'],
	weaponTypes: ['Assault Rifle'],
	wears: ['Factory New', 'Minimal Wear', 'Field-Tested'],
	rarities: ['Classified', 'Covert'],
	collections: ['The Phoenix Collection']
};

function pageData(
	search = '',
	skins: Skin[] = [skin('AK-47', 'Redline', 1), skin('AWP', 'Asiimov', 2)],
	overrides: { total?: number; pageCount?: number; failed?: boolean } = {}
) {
	const query = parseExploreQuery(new URLSearchParams(search));

	return {
		query,
		results: {
			skins: skins.map((s) => ({ skin: s, variant: pickRepresentativeVariant(s.variants) })),
			total: overrides.total ?? skins.length,
			page: query.page,
			pageSize: 24,
			pageCount: overrides.pageCount ?? 1
		},
		options,
		failed: (overrides.failed ?? false) as false
	};
}

/** `PageProps` carries params and form alongside data; the page reads none of them. */
function props(data: ReturnType<typeof pageData>) {
	return { data, params: {}, form: null } as unknown as ComponentProps<typeof ExplorePage>;
}

/** The count is interpolated across several text nodes; read it as one string. */
function resultSummary(container: HTMLElement): string {
	return (container.querySelector('[aria-live="polite"]')?.textContent ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

describe('Explore results', () => {
	it('renders a card per skin with its real catalog identity', () => {
		render(ExplorePage, { props: props(pageData()) });

		expect(screen.getByText('Redline')).toBeInTheDocument();
		expect(screen.getByText('Asiimov')).toBeInTheDocument();
		expect(screen.getAllByText('AK-47').length).toBeGreaterThan(0);
	});

	it('links each card to its skin route', () => {
		render(ExplorePage, { props: props(pageData()) });

		const link = screen.getByRole('link', { name: /Redline/ });
		expect(link).toHaveAttribute('href', '/skins/ak-47-redline');
	});

	it('never claims a price is unavailable when Explore did not ask for one', () => {
		// Explore is catalog-first: no prices are fetched, so no price is
		// missing. Saying otherwise would be telling the visitor something false.
		render(ExplorePage, { props: props(pageData()) });

		expect(screen.queryByText('Price unavailable')).toBeNull();
		expect(screen.queryByText('From')).toBeNull();
	});

	it('reports the total honestly', () => {
		const { container } = render(ExplorePage, {
			props: props(pageData('', undefined, { total: 1994 }))
		});

		// Page one of a full result set covers the whole page size.
		expect(resultSummary(container)).toBe('Showing 1–24 of 1,994 skins');
	});

	it('phrases the count as results when searching', () => {
		const { container } = render(ExplorePage, { props: props(pageData('q=redline')) });

		expect(resultSummary(container)).toContain('2 skins for');
	});
});

describe('Explore filters', () => {
	it('builds its controls from catalog metadata', () => {
		render(ExplorePage, { props: props(pageData()) });

		const sidebar = screen.getByRole('complementary');
		for (const label of ['Weapon', 'Category', 'Exterior', 'Rarity', 'Collection']) {
			expect(within(sidebar).getByText(label)).toBeInTheDocument();
		}
	});

	it('keeps the search text in the field so it can be refined', () => {
		render(ExplorePage, { props: props(pageData('q=redline')) });

		expect(screen.getByRole('searchbox', { name: 'Search skins' })).toHaveValue('redline');
	});

	it('shows a removable chip per active filter, plus clear all', () => {
		render(ExplorePage, { props: props(pageData('weapon=AK-47&rarity=Covert')) });

		expect(screen.getByRole('link', { name: /Remove Weapon filter AK-47/ })).toHaveAttribute(
			'href',
			'/explore?rarity=Covert'
		);
		expect(screen.getByRole('link', { name: /Remove Rarity filter Covert/ })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', '/explore');
	});

	it('shows no active-filter row when nothing is filtered', () => {
		render(ExplorePage, { props: props(pageData()) });

		expect(screen.queryByRole('link', { name: 'Clear all' })).toBeNull();
	});

	it('counts active filters on the mobile trigger', () => {
		render(ExplorePage, { props: props(pageData('weapon=AK-47&stattrak=true')) });

		expect(screen.getByRole('button', { name: /Filters/ })).toHaveAccessibleName(/2 active/);
	});
});

describe('Explore pagination', () => {
	it('is absent when everything fits on one page', () => {
		render(ExplorePage, { props: props(pageData()) });

		expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
	});

	it('marks the current page and links the others, preserving filters', () => {
		render(ExplorePage, {
			props: props(pageData('weapon=AK-47&page=2', undefined, { total: 61, pageCount: 3 }))
		});

		const nav = screen.getByRole('navigation', { name: 'Pagination' });
		expect(within(nav).getByText('2')).toHaveAttribute('aria-current', 'page');
		expect(within(nav).getByRole('link', { name: /Previous/ })).toHaveAttribute(
			'href',
			'/explore?weapon=AK-47'
		);
		expect(within(nav).getByRole('link', { name: /Next/ })).toHaveAttribute(
			'href',
			'/explore?weapon=AK-47&page=3'
		);
	});

	it('renders no link where there is nowhere to go', () => {
		render(ExplorePage, {
			props: props(pageData('', undefined, { total: 50, pageCount: 3 }))
		});

		const nav = screen.getByRole('navigation', { name: 'Pagination' });
		expect(within(nav).queryByRole('link', { name: /Previous/ })).toBeNull();
	});
});

describe('Explore states', () => {
	it('offers a way out of an empty result rather than treating it as an error', () => {
		render(ExplorePage, { props: props(pageData('q=zzz', [], { total: 0 })) });

		expect(screen.getByRole('heading', { name: 'No skins found' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Clear filters' })).toBeInTheDocument();
	});

	it('explains a catalog outage without leaking anything about the upstream', () => {
		const { container } = render(ExplorePage, {
			props: props(pageData('', [], { total: 0, failed: true }))
		});

		expect(
			screen.getByRole('heading', { name: /We couldn't load the catalog/ })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/explore');
		expect(container.textContent).not.toMatch(/CS2Cap|cs2c\.app|api key|50\d/i);
	});
});
