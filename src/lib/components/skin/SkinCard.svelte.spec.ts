import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SkinCard from './SkinCard.svelte';
import type { ResolvedPathname } from '$app/types';
import type { Skin, SkinVariant } from '$lib/types/skin';

function skin(overrides: Partial<Skin> = {}): Skin {
	return {
		id: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		imageUrl: 'https://cdn.example.test/redline.png',
		rarity: { name: 'Classified' },
		variants: [],
		...overrides
	};
}

function variant(overrides: Partial<SkinVariant> = {}): SkinVariant {
	return {
		itemId: 12632,
		marketHashName: 'AK-47 | Redline (Field-Tested)',
		wear: 'Field-Tested',
		statTrak: false,
		souvenir: false,
		...overrides
	};
}

describe('SkinCard identity', () => {
	it('shows the weapon and the finish separately, never joined as well', () => {
		render(SkinCard, { props: { skin: skin() } });

		expect(screen.getByText('AK-47')).toBeInTheDocument();
		expect(screen.getByText('Redline')).toBeInTheDocument();
		// "AK-47 | Redline" as visible text would be a third copy of the name.
		expect(screen.queryByText('AK-47 | Redline')).toBeNull();
	});

	it('renders a knife, gloves and other categories without assuming a rifle', () => {
		render(SkinCard, {
			props: {
				skin: skin({
					weapon: '★ Karambit',
					name: 'Doppler',
					fullName: '★ Karambit | Doppler',
					rarity: { name: 'Extraordinary' }
				})
			}
		});

		expect(screen.getByText('★ Karambit')).toBeInTheDocument();
		expect(screen.getByText('Doppler')).toBeInTheDocument();
	});

	it('renders a long identity without breaking out of the card', () => {
		const longName = 'Welcome to the Jungle Commemorative Edition';
		render(SkinCard, { props: { skin: skin({ weapon: 'M4A1-S', name: longName }) } });

		expect(screen.getByText(longName)).toBeInTheDocument();
	});
});

describe('SkinCard price', () => {
	it('formats a minor-unit amount', () => {
		render(SkinCard, { props: { skin: skin(), priceMinor: 12828 } });

		expect(screen.getByText(/128,28/)).toBeInTheDocument();
		expect(screen.getByText('From')).toBeInTheDocument();
	});

	it('shows an unavailable state when there is no price', () => {
		render(SkinCard, { props: { skin: skin() } });

		expect(screen.getByText('Price unavailable')).toBeInTheDocument();
		expect(screen.queryByText('From')).toBeNull();
	});

	it('never presents a zero price as an offer', () => {
		render(SkinCard, { props: { skin: skin(), priceMinor: 0 } });

		expect(screen.getByText('Price unavailable')).toBeInTheDocument();
		expect(screen.queryByText(/0,00/)).toBeNull();
	});

	it('accepts a caller-supplied label', () => {
		render(SkinCard, { props: { skin: skin(), priceMinor: 12828, priceLabel: 'Best price' } });

		expect(screen.getByText('Best price')).toBeInTheDocument();
	});
});

describe('SkinCard variant', () => {
	it('shows the wear of the selected variant', () => {
		render(SkinCard, { props: { skin: skin(), variant: variant() } });

		expect(screen.getByText('Field-Tested')).toBeInTheDocument();
	});

	it('shows StatTrak, Souvenir and phase only when they apply', () => {
		render(SkinCard, {
			props: { skin: skin(), variant: variant({ statTrak: true, phase: 'Phase 2' }) }
		});

		expect(screen.getByText('StatTrak')).toBeInTheDocument();
		expect(screen.getByText('Phase 2')).toBeInTheDocument();
		expect(screen.queryByText('Souvenir')).toBeNull();
	});

	it('never exposes float range, item id or market hash name', () => {
		const { container } = render(SkinCard, {
			props: {
				skin: skin(),
				variant: variant({ minFloat: 0.1, maxFloat: 0.7 })
			}
		});

		const text = container.textContent ?? '';
		expect(text).not.toContain('0.1');
		expect(text).not.toContain('12632');
		expect(text).not.toContain('(Field-Tested)');
	});
});

describe('SkinCard rarity', () => {
	it('reads the rarity as text, not only as a colour', () => {
		render(SkinCard, { props: { skin: skin() } });

		expect(screen.getByText('Classified')).toBeInTheDocument();
	});

	it('still names an unrecognised rarity', () => {
		render(SkinCard, { props: { skin: skin({ rarity: { name: 'Mythical Ultra Rare' } }) } });

		expect(screen.getByText('Mythical Ultra Rare')).toBeInTheDocument();
	});

	it('omits rarity entirely when the catalog has none', () => {
		const { container } = render(SkinCard, { props: { skin: skin({ rarity: undefined }) } });

		expect(container.querySelector('.rounded-full')).toBeNull();
	});
});

describe('SkinCard linking', () => {
	it('becomes a real link when given a destination', () => {
		render(SkinCard, {
			props: { skin: skin(), href: '/explore' as ResolvedPathname }
		});

		const link = screen.getByRole('link');
		expect(link.tagName).toBe('A');
		expect(link).toHaveAttribute('href', '/explore');
		expect(link).toHaveAccessibleName(/Redline/);
	});

	it('renders no link — and nothing pretending to be one — without a destination', () => {
		render(SkinCard, { props: { skin: skin() } });

		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('nests no interactive element inside the card link', () => {
		render(SkinCard, {
			props: {
				skin: skin(),
				variant: variant(),
				priceMinor: 12828,
				href: '/explore' as ResolvedPathname
			}
		});

		const link = screen.getByRole('link');
		expect(link.querySelectorAll('a, button, input, select, textarea')).toHaveLength(0);
	});
});

describe('SkinCard image', () => {
	it('treats the artwork as decorative, because the card already names the skin', () => {
		render(SkinCard, { props: { skin: skin() } });

		const image = screen.getByRole('presentation', { hidden: true });
		expect(image).toHaveAttribute('alt', '');
		expect(image).toHaveAttribute('loading', 'lazy');
	});

	it('falls back without a broken image when the skin has no artwork', () => {
		const { container } = render(SkinCard, { props: { skin: skin({ imageUrl: undefined }) } });

		expect(container.querySelector('img')).toBeNull();
	});
});
