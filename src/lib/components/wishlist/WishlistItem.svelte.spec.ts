import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import WishlistItemCard from './WishlistItem.svelte';
import type { ResolvedWishlistItem } from '$lib/types/wishlist';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

function item(overrides: Partial<ResolvedWishlistItem> = {}): ResolvedWishlistItem {
	return {
		key: 'ak-47-redline|Field-Tested||',
		skinSlug: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		imageUrl: 'https://cdn.example.test/redline.png',
		rarity: { name: 'Classified' },
		variant: { wear: 'Field-Tested', edition: 'normal' },
		priceState: 'priced',
		currentPriceMinor: 12_843,
		currency: 'BRL',
		providerId: 'skinscom',
		providerName: 'Skins.com',
		...overrides
	};
}

const BASELINE = { amountMinor: 15_300, currency: 'BRL' };

function renderCard(props: Partial<Parameters<typeof WishlistItemCard>[1]> = {}) {
	return render(WishlistItemCard, {
		item: item(),
		onremove: () => {},
		...props
	} as never);
}

describe('what it shows', () => {
	it('names the skin and its exact exterior', () => {
		renderCard();

		expect(screen.getByText('AK-47')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
		expect(screen.getByText('Field-Tested')).toBeInTheDocument();
	});

	it('shows the current price and its marketplace', () => {
		renderCard();

		expect(screen.getByText('R$ 128,43')).toBeInTheDocument();
		expect(screen.getByText('Skins.com')).toBeInTheDocument();
	});

	it('falls back to the provider key when the directory had no name', () => {
		renderCard({ item: item({ providerName: undefined }) });

		expect(screen.getByText('skinscom')).toBeInTheDocument();
	});

	it('links to the exact variant that was saved', () => {
		renderCard();

		expect(screen.getByRole('link', { name: 'Redline' })).toHaveAttribute(
			'href',
			'/skins/ak-47-redline?wear=Field-Tested'
		);
	});

	it('uses the weapon name for a vanilla knife', () => {
		renderCard({
			item: item({ weapon: 'Bayonet', name: '', fullName: 'Bayonet', variant: {} })
		});

		expect(screen.getByRole('link', { name: 'Bayonet' })).toBeInTheDocument();
	});
});

describe('movement since it was saved', () => {
	it('says how much lower, from a buyer’s point of view', () => {
		renderCard({ baseline: BASELINE });

		expect(screen.getByText('R$ 24,57 lower since added')).toBeInTheDocument();
		expect(screen.getByText('Saved at R$ 153,00')).toBeInTheDocument();
	});

	it('says how much higher', () => {
		renderCard({ item: item({ currentPriceMinor: 17_120 }), baseline: BASELINE });

		expect(screen.getByText('R$ 18,20 higher since added')).toBeInTheDocument();
	});

	it('says when nothing changed', () => {
		renderCard({ item: item({ currentPriceMinor: 15_300 }), baseline: BASELINE });

		expect(screen.getByText('No change since added')).toBeInTheDocument();
	});

	it('never speaks in portfolio terms', () => {
		renderCard({ baseline: BASELINE });

		// A wishlist is things someone might buy, not an investment.
		expect(document.body.textContent).not.toMatch(/profit|loss|return|gain|roi|%/i);
	});

	it('states the direction in words, not only in colour', () => {
		renderCard({ baseline: BASELINE });

		const line = screen.getByText('R$ 24,57 lower since added');

		expect(line.textContent).toContain('lower');
	});

	it('invents no comparison without a baseline', () => {
		renderCard();

		expect(screen.getByText('R$ 128,43')).toBeInTheDocument();
		expect(screen.queryByText(/since added/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Saved at/)).not.toBeInTheDocument();
	});

	it('refuses to compare across currencies', () => {
		renderCard({ baseline: { amountMinor: 3000, currency: 'USD' } });

		// There is no FX here. The current price still shows; the movement
		// does not.
		expect(screen.getByText('R$ 128,43')).toBeInTheDocument();
		expect(screen.queryByText(/since added/)).not.toBeInTheDocument();
	});
});

describe('when there is no current price', () => {
	it('separates nothing listed from could not ask', () => {
		const { unmount } = renderCard({
			item: item({ priceState: 'unpriced', currentPriceMinor: undefined, currency: undefined })
		});

		expect(screen.getByText('No current listings')).toBeInTheDocument();
		unmount();

		renderCard({
			item: item({ priceState: 'error', currentPriceMinor: undefined, currency: undefined })
		});

		expect(screen.getByText('Current price unavailable')).toBeInTheDocument();
	});

	it('never compares a baseline against nothing', () => {
		renderCard({
			item: item({ priceState: 'error', currentPriceMinor: undefined, currency: undefined }),
			baseline: BASELINE
		});

		// The baseline is still worth showing; the movement is not inventable.
		expect(screen.getByText('Saved at R$ 153,00')).toBeInTheDocument();
		expect(screen.queryByText(/since added/)).not.toBeInTheDocument();
	});

	it('never renders zero as a price', () => {
		renderCard({
			item: item({ priceState: 'unpriced', currentPriceMinor: undefined, currency: undefined })
		});

		expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
	});
});

describe('controls', () => {
	it('removes this item, and says which one for a screen reader', async () => {
		const onremove = vi.fn();

		renderCard({ onremove });

		const remove = screen.getByRole('button', { name: /Remove AK-47 \| Redline/ });

		await fireEvent.click(remove);

		expect(onremove).toHaveBeenCalledTimes(1);
	});

	it('offers a way to the full comparison', () => {
		renderCard();

		// No "View offer": batch pricing carries no tracked redirect, and the
		// skin page owns marketplace comparison.
		expect(screen.getByRole('link', { name: 'View skin' })).toHaveAttribute(
			'href',
			'/skins/ak-47-redline?wear=Field-Tested'
		);
		expect(screen.queryByText(/View offer/)).not.toBeInTheDocument();
	});

	it('shows when it was saved, readably', () => {
		renderCard({ addedAt: '2026-09-29T10:00:00.000Z' });

		expect(screen.getByText('Added 29 Sept 2026')).toBeInTheDocument();
		// Never the raw timestamp.
		expect(document.body.textContent).not.toContain('2026-09-29T10:00:00.000Z');
	});
});
