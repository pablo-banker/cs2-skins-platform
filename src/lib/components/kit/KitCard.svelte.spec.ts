import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import KitCard from './KitCard.svelte';
import type { KitTag, ResolvedKit, ResolvedKitItem } from '$lib/types/kit';

function item(id: number, weapon: string, name: string): ResolvedKitItem {
	return {
		skin: {
			id: `${weapon}-${name}`.toLowerCase().replace(/\W+/g, '-'),
			weapon,
			name,
			fullName: `${weapon} | ${name}`,
			imageUrl: `https://cdn.example.test/${id}.png`,
			variants: []
		},
		variant: {
			itemId: id,
			marketHashName: `${weapon} | ${name} (Field-Tested)`,
			wear: 'Field-Tested',
			statTrak: false,
			souvenir: false
		}
	};
}

const ITEMS = [
	item(1, 'AK-47', 'Redline'),
	item(2, 'AWP', 'Redline'),
	item(3, 'M4A1-S', 'Hot Rod'),
	item(4, 'Glock-18', 'Candy Apple'),
	item(5, 'USP-S', 'Check Engine')
];

function kit(overrides: Partial<ResolvedKit> = {}): ResolvedKit {
	return {
		slug: 'crimson',
		name: 'Crimson',
		description: 'Red across the rifles and pistols, kept on dark gunmetal bodies.',
		category: 'color',
		tags: ['red', 'black'],
		items: ITEMS,
		...overrides
	};
}

describe('KitCard', () => {
	it('shows the kit name and description', () => {
		render(KitCard, { props: { kit: kit() } });

		expect(screen.getByText('Crimson')).toBeInTheDocument();
		expect(
			screen.getByText('Red across the rifles and pistols, kept on dark gunmetal bodies.')
		).toBeInTheDocument();
	});

	it('counts the skins the kit actually contains', () => {
		render(KitCard, { props: { kit: kit() } });

		expect(screen.getByText('5 skins')).toBeInTheDocument();
	});

	it('links to the kit page by slug', () => {
		render(KitCard, { props: { kit: kit() } });

		expect(screen.getByRole('link')).toHaveAttribute('href', '/kits/crimson');
	});

	it('reads its tags back as capitalised visual direction', () => {
		render(KitCard, { props: { kit: kit() } });

		expect(screen.getByText('Red · Black')).toBeInTheDocument();
	});

	it('renders a single tag without a separator', () => {
		render(KitCard, { props: { kit: kit({ tags: ['blue'] }) } });

		expect(screen.getByText('Blue')).toBeInTheDocument();
	});

	it('covers the card with the first four items, in editorial order', () => {
		const { container } = render(KitCard, { props: { kit: kit() } });
		const images = [...container.querySelectorAll('img')];

		expect(images).toHaveLength(4);
		expect(images[0]).toHaveAttribute('src', 'https://cdn.example.test/1.png');
		expect(images[3]).toHaveAttribute('src', 'https://cdn.example.test/4.png');
	});

	it('prefers the variant artwork the kit resolved to', () => {
		const withVariantArt = kit({
			items: [
				{
					...ITEMS[0],
					variant: { ...ITEMS[0].variant, imageUrl: 'https://cdn.example.test/variant.png' }
				},
				...ITEMS.slice(1)
			]
		});

		const { container } = render(KitCard, { props: { kit: withVariantArt } });

		expect(container.querySelector('img')).toHaveAttribute(
			'src',
			'https://cdn.example.test/variant.png'
		);
	});

	it('shows no price — a kit total depends on live market data', () => {
		const { container } = render(KitCard, { props: { kit: kit() } });

		expect(container.textContent).not.toMatch(/R\$|Price|From|Best price/);
	});

	it('renders a long name and a full-length description without losing either', () => {
		const long = kit({
			name: 'Commemorative Midnight Edition',
			description:
				'A deliberately long single-sentence description that runs to the limit the schema allows, to be sure the card wraps it instead of clipping it.',
			tags: ['black', 'white', 'gray', 'minimal'] as KitTag[]
		});

		render(KitCard, { props: { kit: long } });

		expect(screen.getByText('Commemorative Midnight Edition')).toBeInTheDocument();
		expect(screen.getByText(long.description)).toBeInTheDocument();
		expect(screen.getByText('Black · White · Gray · Minimal')).toBeInTheDocument();
	});

	it('keeps the cover out of the accessibility tree — the text carries the meaning', () => {
		const { container } = render(KitCard, { props: { kit: kit() } });

		expect(container.querySelector('[aria-hidden="true"] img')).not.toBeNull();
		expect(screen.queryByRole('img')).toBeNull();
	});
});
