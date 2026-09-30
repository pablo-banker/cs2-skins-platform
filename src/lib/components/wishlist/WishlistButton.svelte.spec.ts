import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import WishlistButton from './WishlistButton.svelte';
import { readWishlist } from '$lib/features/wishlist';
import { WISHLIST_STORAGE_KEY } from '$lib/schemas/wishlist';

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const REDLINE_FT = {
	skinSlug: 'ak-47-redline',
	variant: { wear: 'Field-Tested', edition: 'normal' as const }
};

function button() {
	return screen.getByRole('button', { name: /wishlist/i });
}

describe('saving from the skin page', () => {
	it('starts unsaved once hydrated', async () => {
		render(WishlistButton, REDLINE_FT);

		await waitFor(() => expect(button()).toHaveAttribute('aria-pressed', 'false'));
		expect(button()).toHaveTextContent('Add to wishlist');
	});

	it('saves the exact variant', async () => {
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		expect(readWishlist()).toMatchObject([
			{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested', edition: 'normal' } }
		]);
	});

	it('snapshots the current price beside it', async () => {
		render(WishlistButton, {
			...REDLINE_FT,
			currentPrice: { amountMinor: 15_300, currency: 'BRL' }
		});

		await fireEvent.click(button());

		expect(readWishlist()[0]).toMatchObject({ addedPriceMinor: 15_300, currency: 'BRL' });
	});

	it('saves without a baseline when nothing is currently listed', async () => {
		// Refusing the save because the market is quiet would be the wrong
		// failure.
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		expect(readWishlist()[0].addedPriceMinor).toBeUndefined();
		expect(readWishlist()[0].currency).toBeUndefined();
	});

	it('records when it was saved', async () => {
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		expect(() => new Date(readWishlist()[0].addedAt).toISOString()).not.toThrow();
	});

	it('says so afterwards', async () => {
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		expect(button()).toHaveTextContent('In wishlist');
		expect(button()).toHaveAttribute('aria-pressed', 'true');
	});

	it('navigates nowhere', async () => {
		render(WishlistButton, REDLINE_FT);

		// A plain button, not a link: saving is not a destination.
		expect(button().tagName).toBe('BUTTON');
		expect(button()).toHaveAttribute('type', 'button');
	});
});

describe('removing again', () => {
	it('toggles back off', async () => {
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());
		await fireEvent.click(button());

		expect(readWishlist()).toEqual([]);
		expect(button()).toHaveTextContent('Add to wishlist');
	});

	it('leaves other saved variants alone', async () => {
		render(WishlistButton, {
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Minimal Wear', edition: 'normal' as const }
		});
		await fireEvent.click(button());

		localStorage.setItem(
			WISHLIST_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				items: [
					...readWishlist(),
					{
						skinSlug: 'awp-asiimov',
						variant: {},
						addedAt: '2026-09-01T00:00:00.000Z'
					}
				]
			})
		);

		await fireEvent.click(button());

		expect(readWishlist().map((entry) => entry.skinSlug)).toEqual(['awp-asiimov']);
	});
});

describe('membership is exact', () => {
	it('shows saved when this exact variant is stored', async () => {
		localStorage.setItem(
			WISHLIST_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				items: [
					{
						skinSlug: 'ak-47-redline',
						variant: { wear: 'Field-Tested' },
						addedAt: '2026-09-29T10:00:00.000Z'
					}
				]
			})
		);

		render(WishlistButton, REDLINE_FT);

		await waitFor(() => expect(button()).toHaveTextContent('In wishlist'));
	});

	it('shows unsaved for a different exterior of a saved skin', async () => {
		// The failure this guards: treating the grouped skin as wishlisted and
		// offering to "remove" something that was never saved.
		localStorage.setItem(
			WISHLIST_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				items: [
					{
						skinSlug: 'ak-47-redline',
						variant: { wear: 'Field-Tested' },
						addedAt: '2026-09-29T10:00:00.000Z'
					}
				]
			})
		);

		render(WishlistButton, {
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Minimal Wear', edition: 'normal' as const }
		});

		await waitFor(() => expect(button()).toHaveTextContent('Add to wishlist'));
	});

	it('takes an independent baseline per variant', async () => {
		const first = render(WishlistButton, {
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Field-Tested', edition: 'normal' as const },
			currentPrice: { amountMinor: 15_300, currency: 'BRL' }
		});

		await fireEvent.click(button());
		first.unmount();

		render(WishlistButton, {
			skinSlug: 'ak-47-redline',
			variant: { wear: 'Minimal Wear', edition: 'normal' as const },
			currentPrice: { amountMinor: 64_739, currency: 'BRL' }
		});

		await fireEvent.click(button());

		const saved = readWishlist();

		expect(saved).toHaveLength(2);
		expect(saved.map((entry) => entry.addedPriceMinor).sort((a, b) => a! - b!)).toEqual([
			15_300, 64_739
		]);
	});
});

describe('a full wishlist', () => {
	function fill() {
		localStorage.setItem(
			WISHLIST_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				items: Array.from({ length: 50 }, (_, index) => ({
					skinSlug: `skin-${String(index).padStart(3, '0')}`,
					variant: {},
					addedAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
				}))
			})
		);
	}

	it('says so rather than silently doing nothing', async () => {
		fill();
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		expect(screen.getByRole('status')).toHaveTextContent(/wishlist is full/i);
		expect(screen.getByRole('status')).toHaveTextContent('50');
	});

	it('deletes nothing and saves nothing', async () => {
		fill();
		const before = localStorage.getItem(WISHLIST_STORAGE_KEY);

		render(WishlistButton, REDLINE_FT);
		await fireEvent.click(button());

		expect(localStorage.getItem(WISHLIST_STORAGE_KEY)).toBe(before);
		expect(readWishlist()).toHaveLength(50);
		expect(readWishlist().map((entry) => entry.skinSlug)).toContain('skin-000');
	});

	it('leaves the control offering to save', async () => {
		fill();
		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		// It was not saved, so it must not claim to be.
		expect(button()).toHaveTextContent('Add to wishlist');
		expect(button()).toHaveAttribute('aria-pressed', 'false');
	});

	it('says nothing before the visitor tries', () => {
		fill();
		render(WishlistButton, REDLINE_FT);

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});
});

describe('when storage will not cooperate', () => {
	it('still renders, and still responds to a click', async () => {
		vi.stubGlobal('localStorage', undefined);

		render(WishlistButton, REDLINE_FT);

		await fireEvent.click(button());

		// The save is lost, but a control that ignores a click is a bug.
		expect(button()).toHaveTextContent('In wishlist');
	});
});
