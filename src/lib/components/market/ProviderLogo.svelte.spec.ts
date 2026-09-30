import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ProviderLogo from './ProviderLogo.svelte';
import type { MarketProvider } from '$lib/types/provider';

const withLogo: MarketProvider = {
	id: 'csfloat',
	name: 'CSFloat',
	logoUrl: 'https://cdn.example.test/csfloat.png',
	status: 'up'
};

const withoutLogo: MarketProvider = { id: 'quiet', name: 'Quiet Market', status: 'up' };

describe('ProviderLogo', () => {
	it('renders the logo with the provider as its accessible name', () => {
		render(ProviderLogo, { props: { provider: withLogo } });

		expect(screen.getByRole('img', { name: 'CSFloat' })).toHaveAttribute('src', withLogo.logoUrl);
	});

	it('can be decorative when the name is already rendered beside it', () => {
		render(ProviderLogo, { props: { provider: withLogo, decorative: true } });

		expect(screen.queryByRole('img', { name: 'CSFloat' })).toBeNull();
		expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute('alt', '');
	});

	it('falls back to the initial without inventing a logo', () => {
		render(ProviderLogo, { props: { provider: withoutLogo } });

		expect(screen.queryByRole('img')).toBeNull();
		expect(screen.getByText('Q')).toBeInTheDocument();
		// The name still reaches a screen reader.
		expect(screen.getByText('Quiet Market')).toBeInTheDocument();
	});
});
