import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import { mount, unmount } from 'svelte';
import HomeSkinSearch from './HomeSkinSearch.svelte';
import { SEARCH_MIN_QUERY_LENGTH } from '$lib/schemas/search';
import type { SkinSearchItem } from '$lib/features/skins/search-result';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

function result(slug: string, weapon: string, name: string): SkinSearchItem {
	return {
		slug,
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		imageUrl: `https://cdn.example.test/${slug}.png`,
		rarity: { name: 'Classified' },
		representativeWear: 'Minimal Wear'
	};
}

const REDLINES = [
	result('ak-47-redline', 'AK-47', 'Redline'),
	result('awp-redline', 'AWP', 'Redline')
];

const fetchMock = vi.fn();
let items: SkinSearchItem[];
let fails = false;

let mounted: { component: Record<string, unknown>; target: HTMLElement } | undefined;

/** Mounts the search under a query client, as the homepage does. */
function renderSearch() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const target = document.createElement('div');
	document.body.append(target);

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const child = (anchor: any) => (HomeSkinSearch as any)(anchor, {});
	/* eslint-enable @typescript-eslint/no-explicit-any */

	const component = mount(QueryClientProvider, {
		target,
		props: { client, children: child as never }
	});

	mounted = { component: component as Record<string, unknown>, target };
}

function field() {
	return screen.getByLabelText('Search for a skin');
}

function results() {
	return screen.getByRole('list', { name: 'Search results' });
}

async function type(value: string) {
	await fireEvent.focus(field());
	await fireEvent.input(field(), { target: { value } });
}

beforeEach(() => {
	vi.useFakeTimers();
	items = REDLINES;
	fails = false;

	fetchMock.mockReset();
	fetchMock.mockImplementation(async (url: string) => {
		if (!String(url).startsWith('/api/search/skins')) throw new Error(`unexpected: ${url}`);
		if (fails) return new Response('nope', { status: 503 });

		return new Response(JSON.stringify({ query: 'q', items, hasMore: false }), {
			headers: { 'content-type': 'application/json' }
		});
	});

	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();

	if (!mounted) return;

	unmount(mounted.component);
	mounted.target.remove();
	document.body.replaceChildren();
	mounted = undefined;
});

/** Lets the debounce elapse and the query settle. */
async function settle() {
	await vi.advanceTimersByTimeAsync(400);
	await waitFor(() => expect(fetchMock).toHaveBeenCalled());
}

describe('the field', () => {
	it('is labelled distinctly from the header trigger', () => {
		renderSearch();

		// Two controls named "Search skins" on one page would be ambiguous for
		// anyone navigating by name.
		expect(field()).toBeInTheDocument();
		expect(screen.queryByLabelText('Search skins')).not.toBeInTheDocument();
	});

	it('is a real search landmark', () => {
		renderSearch();

		expect(screen.getByRole('search')).toBeInTheDocument();
		expect(field()).toHaveAttribute('type', 'search');
	});
});

describe('the threshold', () => {
	it('searches nothing for one character', async () => {
		renderSearch();
		await type('a');
		await vi.advanceTimersByTimeAsync(400);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument();
		expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
	});

	it('searches once the query is long enough', async () => {
		renderSearch();
		await type('redline');
		await settle();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/search/skins?q=redline',
			expect.objectContaining({ signal: expect.anything() })
		);
	});

	it('waits for typing to settle rather than firing per keystroke', async () => {
		renderSearch();

		await type('r');
		await type('re');
		await type('red');
		await vi.advanceTimersByTimeAsync(400);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toContain('q=red');
	});
});

describe('results', () => {
	it('lists what came back', async () => {
		renderSearch();
		await type('redline');
		await settle();

		await waitFor(() => expect(results()).toBeInTheDocument());

		const links = within(results()).getAllByRole('link');

		expect(links).toHaveLength(2);
		expect(links[0]).toHaveAttribute('href', '/skins/ak-47-redline');
		expect(links[1]).toHaveAttribute('href', '/skins/awp-redline');
	});

	it('shows the weapon, the finish and the exterior', async () => {
		renderSearch();
		await type('redline');
		await settle();

		await waitFor(() => expect(results()).toBeInTheDocument());

		expect(within(results()).getAllByText('AK-47').length).toBeGreaterThan(0);
		expect(within(results()).getAllByText('Redline').length).toBeGreaterThan(0);
		expect(within(results()).getAllByText('Minimal Wear').length).toBeGreaterThan(0);
	});

	it('shows no price, because none was requested', async () => {
		renderSearch();
		await type('redline');
		await settle();

		await waitFor(() => expect(results()).toBeInTheDocument());

		// Search is a navigator; comparison lives on the skin page.
		expect(within(results()).queryByText(/R\$/)).not.toBeInTheDocument();
		expect(within(results()).queryByText(/Price unavailable/)).not.toBeInTheDocument();
	});

	it('offers the full result set', async () => {
		renderSearch();
		await type('redline');
		await settle();

		await waitFor(() => expect(results()).toBeInTheDocument());

		expect(screen.getByRole('link', { name: /View all results/ })).toHaveAttribute(
			'href',
			'/explore?q=redline'
		);
	});

	it('says so when nothing matched', async () => {
		items = [];
		renderSearch();
		await type('zzzzz');
		await settle();

		await waitFor(() => expect(screen.getByText(/No skins found for/)).toBeInTheDocument());
	});

	it('announces that it is searching', async () => {
		renderSearch();
		await type('redline');

		expect(screen.getByRole('status')).toHaveTextContent('Searching');
	});
});

describe('when search fails', () => {
	it('says so and offers to retry, without taking the page down', async () => {
		fails = true;
		renderSearch();
		await type('redline');
		await settle();

		// The query retries once before giving up; its backoff is on a timer
		// the fake clock has to be walked past.
		await vi.advanceTimersByTimeAsync(5000);

		await waitFor(() =>
			expect(screen.getByText('Search is temporarily unavailable.')).toBeInTheDocument()
		);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
	});
});

describe('what it costs', () => {
	it('only ever calls our own search endpoint', async () => {
		renderSearch();
		await type('redline');
		await settle();

		await waitFor(() => expect(results()).toBeInTheDocument());

		// No prices, no providers, no history, and never CS2Cap directly.
		for (const [url] of fetchMock.mock.calls) {
			expect(String(url)).toMatch(/^\/api\/search\/skins/);
		}
	});
});
