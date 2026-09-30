import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ProviderPriceRow from './ProviderPriceRow.svelte';
import type { MarketProvider } from '$lib/types/provider';
import type { MarketQuote } from '$lib/types/market';

function provider(overrides: Partial<MarketProvider> = {}): MarketProvider {
	return {
		id: 'skinport',
		name: 'Skinport',
		logoUrl: 'https://cdn.example.test/skinport.png',
		marketType: 'P2P',
		status: 'up',
		...overrides
	};
}

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
	return {
		providerId: 'skinport',
		itemId: 12632,
		priceMinor: 12828,
		currency: 'BRL',
		quantity: 570,
		stale: false,
		redirectUrl: 'https://cs2c.app/r/skinport/12632',
		...overrides
	};
}

describe('ProviderPriceRow', () => {
	it('names the provider and formats its minor-unit ask', () => {
		render(ProviderPriceRow, { props: { quote: quote(), provider: provider() } });

		expect(screen.getByText('Skinport')).toBeInTheDocument();
		expect(screen.getByText(/128,28/)).toBeInTheDocument();
	});

	it('falls back to the provider key when the directory is not loaded', () => {
		render(ProviderPriceRow, { props: { quote: quote({ providerId: 'csfloat' }) } });

		expect(screen.getByText('csfloat')).toBeInTheDocument();
	});

	it('marks the best price in words, not only in colour', () => {
		render(ProviderPriceRow, { props: { quote: quote(), provider: provider(), best: true } });

		expect(screen.getByText('Best price')).toBeInTheDocument();
	});

	it('does not claim best price unless asked to', () => {
		render(ProviderPriceRow, { props: { quote: quote(), provider: provider() } });

		expect(screen.queryByText('Best price')).toBeNull();
	});

	it('links out safely when the quote carries a tracked redirect', () => {
		render(ProviderPriceRow, { props: { quote: quote(), provider: provider() } });

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', 'https://cs2c.app/r/skinport/12632');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		expect(link).toHaveAccessibleName(/Skinport/);
		expect(link).toHaveAccessibleName(/opens in a new tab/i);
	});

	it('stays informational — no dead control — when there is no redirect', () => {
		render(ProviderPriceRow, {
			props: { quote: quote({ redirectUrl: undefined }), provider: provider() }
		});

		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Skinport')).toBeInTheDocument();
	});

	it('shows an unavailable state rather than a zero price', () => {
		render(ProviderPriceRow, {
			props: { quote: quote({ priceMinor: 0 }), provider: provider() }
		});

		expect(screen.getByText('Price unavailable')).toBeInTheDocument();
		expect(screen.queryByText(/0,00/)).toBeNull();
	});

	it('does not show quantity, whose semantics are not settled', () => {
		const { container } = render(ProviderPriceRow, {
			props: { quote: quote(), provider: provider() }
		});

		expect(container.textContent).not.toContain('570');
	});
});
