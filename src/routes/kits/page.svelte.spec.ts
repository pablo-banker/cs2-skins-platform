import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import KitsPage from './+page.svelte';

// The page builds its canonical URL from the current origin.
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/kits') } }));
import type { ResolvedKit, ResolvedKitItem } from '$lib/types/kit';

function item(id: number): ResolvedKitItem {
	return {
		skin: {
			id: `skin-${id}`,
			weapon: 'AK-47',
			name: `Finish ${id}`,
			fullName: `AK-47 | Finish ${id}`,
			imageUrl: `https://cdn.example.test/${id}.png`,
			variants: []
		},
		variant: {
			itemId: id,
			marketHashName: `AK-47 | Finish ${id} (Field-Tested)`,
			wear: 'Field-Tested',
			statTrak: false,
			souvenir: false
		}
	};
}

function kit(slug: string, name: string, count = 5): ResolvedKit {
	return {
		slug,
		name,
		description: `What ${name} is about.`,
		category: 'color',
		tags: ['red'],
		items: Array.from({ length: count }, (_, index) => item(index + 1))
	};
}

/** `PageProps` carries params and form alongside data; the page reads none of them. */
function props(kits: ResolvedKit[]) {
	return { data: { kits }, params: {}, form: null } as unknown as ComponentProps<typeof KitsPage>;
}

describe('Kits page', () => {
	it('introduces what a kit is', () => {
		render(KitsPage, { props: props([kit('crimson', 'Crimson')]) });

		expect(screen.getByRole('heading', { level: 1, name: 'Kits' })).toBeInTheDocument();
	});

	it('renders a card per kit, in the dataset order', () => {
		render(KitsPage, {
			props: props([
				kit('crimson', 'Crimson'),
				kit('monochrome', 'Monochrome', 4),
				kit('cobalt', 'Cobalt')
			])
		});

		const names = screen
			.getAllByRole('heading', { level: 3 })
			.map((heading) => heading.textContent);

		expect(names).toEqual(['Crimson', 'Monochrome', 'Cobalt']);
	});

	it('links each card to its own kit page', () => {
		render(KitsPage, { props: props([kit('crimson', 'Crimson'), kit('cobalt', 'Cobalt')]) });

		expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
			'/kits/crimson',
			'/kits/cobalt'
		]);
	});

	it('reports each kit’s real size', () => {
		render(KitsPage, { props: props([kit('crimson', 'Crimson'), kit('mono', 'Mono', 4)]) });

		expect(screen.getByText('5 skins')).toBeInTheDocument();
		expect(screen.getByText('4 skins')).toBeInTheDocument();
	});

	it('says so plainly when there are no kits', () => {
		render(KitsPage, { props: props([]) });

		expect(screen.getByText('No kits yet.')).toBeInTheDocument();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('offers no filter or sort controls — four kits do not need them', () => {
		render(KitsPage, { props: props([kit('crimson', 'Crimson')]) });

		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.queryByRole('searchbox')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('quotes no price anywhere on the catalog', () => {
		const { container } = render(KitsPage, { props: props([kit('crimson', 'Crimson')]) });

		expect(container.textContent).not.toMatch(/R\$|Best price|Price unavailable/);
	});
});
