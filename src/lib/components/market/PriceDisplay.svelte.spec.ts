import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PriceDisplay from './PriceDisplay.svelte';
import PriceUnavailable from './PriceUnavailable.svelte';

describe('PriceDisplay', () => {
	it('formats minor units in the display currency', () => {
		render(PriceDisplay, { props: { amountMinor: 12828 } });

		expect(screen.getByText(/R\$/)).toBeInTheDocument();
		expect(screen.getByText(/128,28/)).toBeInTheDocument();
	});

	it('honours a per-quote currency', () => {
		render(PriceDisplay, { props: { amountMinor: 12828, currency: 'JPY' } });

		// 12828 JPY is twelve thousand yen, not 128 — the scale is per currency.
		expect(screen.getByText(/12\.828/)).toBeInTheDocument();
	});

	it('shows an optional label above the amount', () => {
		render(PriceDisplay, { props: { amountMinor: 12828, label: 'From' } });

		expect(screen.getByText('From')).toBeInTheDocument();
	});

	it('refuses to present zero, negative or missing amounts as prices', () => {
		for (const amountMinor of [0, -500, null, undefined]) {
			const { unmount } = render(PriceDisplay, { props: { amountMinor } });

			expect(screen.getByText('Price unavailable')).toBeInTheDocument();
			unmount();
		}
	});
});

describe('PriceUnavailable', () => {
	it('states the situation plainly without blaming the marketplace', () => {
		render(PriceUnavailable);

		const message = screen.getByText('Price unavailable');
		expect(message).toBeInTheDocument();
		// We know we have no price; we do not know the provider is offline.
		expect(message.textContent).not.toMatch(/offline|down|error/i);
	});
});
