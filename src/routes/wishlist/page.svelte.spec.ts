import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import WishlistPage from './+page.svelte';
import { readWishlist } from '$lib/features/wishlist';
import { WISHLIST_STORAGE_KEY } from '$lib/schemas/wishlist';
import type { WishlistItem } from '$lib/schemas/wishlist';
import type { ResolvedWishlistItem, WishlistResolution } from '$lib/types/wishlist';

// The page builds its canonical URL from the current origin.
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/wishlist') } }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

function saved(overrides: Partial<WishlistItem> = {}): WishlistItem {
	return {
		skinSlug: 'ak-47-redline',
		variant: { wear: 'Field-Tested' },
		addedAt: '2026-09-29T10:00:00.000Z',
		addedPriceMinor: 15_300,
		currency: 'BRL',
		...overrides
	};
}

function resolved(overrides: Partial<ResolvedWishlistItem> = {}): ResolvedWishlistItem {
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

const AWP_SAVED = saved({
	skinSlug: 'awp-asiimov',
	variant: {},
	addedAt: '2026-09-28T10:00:00.000Z',
	addedPriceMinor: 40_000
});

const AWP_RESOLVED = resolved({
	key: 'awp-asiimov|||',
	skinSlug: 'awp-asiimov',
	weapon: 'AWP',
	name: 'Asiimov',
	fullName: 'AWP | Asiimov',
	variant: {},
	currentPriceMinor: 45_000
});

const fetchMock = vi.fn();
let response: WishlistResolution;

function store(items: WishlistItem[]) {
	localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, items }));
}

beforeEach(() => {
	localStorage.clear();
	response = { items: [resolved()], rejected: [] };

	fetchMock.mockReset();
	fetchMock.mockImplementation(async (url: string) => {
		if (String(url) !== '/api/wishlist/resolve') throw new Error(`unexpected: ${url}`);

		return new Response(JSON.stringify(response), {
			headers: { 'content-type': 'application/json' }
		});
	});

	vi.stubGlobal('fetch', fetchMock);
});

const props = () =>
	({ data: {}, params: {}, form: null }) as unknown as ComponentProps<typeof WishlistPage>;

function list() {
	return screen.getByRole('list', { name: 'Saved skins' });
}

describe('the page itself', () => {
	it('has one h1', () => {
		render(WishlistPage, props());

		expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
		expect(screen.getByRole('heading', { level: 1, name: 'Wishlist' })).toBeInTheDocument();
	});

	it('says the list lives on this device', () => {
		render(WishlistPage, props());

		// Stated in words, not implied. Nothing here syncs anywhere.
		expect(screen.getByText('Saved on this device.')).toBeInTheDocument();
	});

	it('keeps saved skins out of the page metadata', () => {
		store([saved()]);
		render(WishlistPage, props());

		const description = document.head
			.querySelector('meta[name="description"]')
			?.getAttribute('content');

		expect(description).not.toMatch(/Redline|R\$/);
	});
});

describe('restoring', () => {
	it('says it is loading rather than flashing the empty state', () => {
		store([saved()]);
		render(WishlistPage, props());

		// "Your wishlist is empty" in front of someone with saved skins is a
		// lie the page tells about itself.
		expect(screen.getByText('Loading your wishlist…')).toBeInTheDocument();
		expect(screen.queryByText('Your wishlist is empty')).not.toBeInTheDocument();
	});

	it('sends identities only', async () => {
		store([saved()]);
		render(WishlistPage, props());

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());

		const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));

		expect(body).toEqual({
			items: [{ skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }]
		});
		// The snapshot and the timestamp are the browser's business.
		expect(JSON.stringify(body)).not.toMatch(/addedAt|addedPriceMinor/);
	});

	it('renders the resolved cards', async () => {
		store([saved()]);
		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('R$ 128,43')).toBeInTheDocument());
		expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
		expect(screen.getByText('1 saved skin')).toBeInTheDocument();
	});

	it('joins each baseline back onto its own card', async () => {
		store([saved(), AWP_SAVED]);
		response = { items: [resolved(), AWP_RESOLVED], rejected: [] };

		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('2 saved skins')).toBeInTheDocument());

		// Redline fell 153,00 → 128,43; the AWP rose 400,00 → 450,00.
		expect(screen.getByText('R$ 24,57 lower since added')).toBeInTheDocument();
		expect(screen.getByText('R$ 50,00 higher since added')).toBeInTheDocument();
	});

	it('shows the newest first', async () => {
		store([AWP_SAVED, saved()]);
		response = { items: [AWP_RESOLVED, resolved()], rejected: [] };

		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('2 saved skins')).toBeInTheDocument());

		const names = within(list())
			.getAllByRole('listitem')
			.map((card) => within(card).getAllByRole('link')[0].textContent?.trim());

		expect(names).toEqual(['Redline', 'Asiimov']);
	});

	it('asks for nothing when nothing is saved', async () => {
		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument());
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('offers a way out of the empty state', async () => {
		render(WishlistPage, props());

		await waitFor(() =>
			expect(screen.getByRole('link', { name: 'Explore skins' })).toHaveAttribute(
				'href',
				'/explore'
			)
		);
	});

	it('keeps the saved list when the request fails', async () => {
		store([saved()]);
		fetchMock.mockRejectedValue(new Error('offline'));

		render(WishlistPage, props());

		await waitFor(() =>
			expect(screen.getByText('Your wishlist could not be loaded')).toBeInTheDocument()
		);
		// Nothing pruned on a failure — the network blinking must not delete
		// someone's wishlist.
		expect(readWishlist()).toHaveLength(1);
	});

	it('loads once, and never polls', async () => {
		vi.useFakeTimers();
		store([saved()]);

		render(WishlistPage, props());

		await vi.advanceTimersByTimeAsync(60_000);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});
});

describe('items the catalog no longer has', () => {
	it('says how many went, and prunes exactly those', async () => {
		store([saved(), AWP_SAVED]);
		response = {
			items: [resolved()],
			rejected: [{ key: 'awp-asiimov|||', skinSlug: 'awp-asiimov', reason: 'unknown-skin' }]
		};

		render(WishlistPage, props());

		await waitFor(() =>
			expect(
				screen.getByText('One saved skin is no longer available and was removed.')
			).toBeInTheDocument()
		);

		expect(readWishlist().map((entry) => entry.skinSlug)).toEqual(['ak-47-redline']);
		expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
	});

	it('counts more than one', async () => {
		store([saved(), AWP_SAVED]);
		response = {
			items: [],
			rejected: [
				{
					key: 'ak-47-redline|Field-Tested||',
					skinSlug: 'ak-47-redline',
					reason: 'invalid-variant'
				},
				{ key: 'awp-asiimov|||', skinSlug: 'awp-asiimov', reason: 'unknown-skin' }
			]
		};

		render(WishlistPage, props());

		await waitFor(() =>
			expect(
				screen.getByText('2 saved skins are no longer available and were removed.')
			).toBeInTheDocument()
		);
	});
});

describe('removing', () => {
	it('drops the card and the stored entry', async () => {
		store([saved(), AWP_SAVED]);
		response = { items: [resolved(), AWP_RESOLVED], rejected: [] };

		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('2 saved skins')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Remove AK-47 | Redline' }));

		expect(screen.getByText('1 saved skin')).toBeInTheDocument();
		expect(readWishlist().map((entry) => entry.skinSlug)).toEqual(['awp-asiimov']);
	});

	it('does not re-price the rest', async () => {
		store([saved(), AWP_SAVED]);
		response = { items: [resolved(), AWP_RESOLVED], rejected: [] };

		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('2 saved skins')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Remove AK-47 | Redline' }));

		// The other prices are still the prices we were just given.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('falls back to the empty state when the last one goes', async () => {
		store([saved()]);
		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Remove AK-47 | Redline' }));

		expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument();
	});
});

describe('clearing', () => {
	it('is offered only when something is saved', async () => {
		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument());
		expect(screen.queryByRole('button', { name: 'Clear wishlist' })).not.toBeInTheDocument();
	});

	it('confirms first', async () => {
		store([saved()]);
		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Clear wishlist' }));

		expect(await screen.findByRole('dialog')).toHaveTextContent('Clear your wishlist?');
		// Nothing has gone yet.
		expect(readWishlist()).toHaveLength(1);
	});

	it('keeps everything when declined', async () => {
		store([saved()]);
		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Clear wishlist' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Keep them' }));

		expect(readWishlist()).toHaveLength(1);
	});

	it('empties the list and the storage key when confirmed', async () => {
		store([saved()]);
		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Clear wishlist' }));

		const dialog = await screen.findByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Clear wishlist' }));

		expect(readWishlist()).toEqual([]);
		expect(localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull();
		expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument();
	});

	it('asks the market nothing', async () => {
		store([saved()]);
		render(WishlistPage, props());
		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Clear wishlist' }));
		const dialog = await screen.findByRole('dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Clear wishlist' }));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('when the market is quiet', () => {
	it('keeps the item and its identity', async () => {
		store([saved()]);
		response = {
			items: [resolved({ priceState: 'error', currentPriceMinor: undefined, currency: undefined })],
			rejected: []
		};

		render(WishlistPage, props());

		await waitFor(() => expect(screen.getByText('1 saved skin')).toBeInTheDocument());
		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
		expect(screen.getByText('Current price unavailable')).toBeInTheDocument();
		// No invented comparison against nothing.
		expect(screen.queryByText(/since added/)).not.toBeInTheDocument();
	});
});
