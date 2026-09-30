import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import { mount, unmount } from 'svelte';
import BuildPage from './+page.svelte';
import { loadoutSections, LOADOUT_SLOTS } from '$lib/config/loadout';
import { BUILDER_STORAGE_KEY } from '$lib/schemas/loadout-persistence';
import { decodeLoadout } from '$lib/features/loadout/share';
import type { LoadoutPricingResult, LoadoutSkinPage } from '$lib/types/loadout';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/build'), state: {} }
}));

// Navigation is a page concern; the test only needs to see whether it happened.
const { replaceStateMock } = vi.hoisted(() => ({ replaceStateMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ replaceState: replaceStateMock }));

/** One AK-47 option with two exteriors, as the picker endpoint returns them. */
const AK_PAGE: LoadoutSkinPage = {
	slotId: 'ak-47',
	options: [
		{
			slug: 'ak-47-redline',
			weapon: 'AK-47',
			name: 'Redline',
			fullName: 'AK-47 | Redline',
			imageUrl: 'https://cdn.example.test/redline.png',
			rarity: { name: 'Classified' },
			variants: [
				{ itemId: 101, wear: 'Factory New', statTrak: false, souvenir: false },
				{ itemId: 102, wear: 'Field-Tested', statTrak: false, souvenir: false }
			]
		},
		{
			slug: 'ak-47-slate',
			weapon: 'AK-47',
			name: 'Slate',
			fullName: 'AK-47 | Slate',
			rarity: { name: 'Restricted' },
			variants: [{ itemId: 201, wear: 'Field-Tested', statTrak: false, souvenir: false }]
		}
	],
	total: 2,
	page: 1,
	pageCount: 1
};

function pricingResult(overrides: Partial<LoadoutPricingResult> = {}): LoadoutPricingResult {
	return {
		items: [
			{
				slotId: 'ak-47',
				skinSlug: 'ak-47-redline',
				state: 'priced',
				bestPriceMinor: 12815,
				currency: 'BRL',
				providerId: 'csfloat',
				providerName: 'CSFloat'
			}
		],
		total: { priceMinor: 12815, currency: 'BRL' },
		steam: { totalMinor: 15000, currency: 'BRL', savingsMinor: 2185 },
		complete: true,
		// Matches a loadout holding only the Factory New AK, which is what the
		// flow below selects.
		fingerprint: 'ak-47:ak-47-redline:Factory New:normal:',
		...overrides
	};
}

const fetchMock = vi.fn();
let pricingResponse: LoadoutPricingResult;

beforeEach(() => {
	sharedData = { state: 'none' };
	replaceStateMock.mockReset();
	pricingResponse = pricingResult();
	localStorage.clear();
	fetchMock.mockReset();

	fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
		if (String(url).startsWith('/api/build/skins')) {
			return new Response(JSON.stringify(AK_PAGE), {
				headers: { 'content-type': 'application/json' }
			});
		}

		if (String(url) === '/api/build/prices') {
			void init;
			return new Response(JSON.stringify(pricingResponse), {
				headers: { 'content-type': 'application/json' }
			});
		}

		throw new Error(`unexpected fetch: ${url}`);
	});

	vi.stubGlobal('fetch', fetchMock);
});

let mounted: { component: Record<string, unknown>; target: HTMLElement } | undefined;

/**
 * Renders the page inside a QueryClientProvider, as the root layout does.
 *
 * Mounted by hand rather than through `render` because the page needs a query
 * client above it, so the teardown is by hand too.
 */
function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	});

	const target = document.createElement('div');
	document.body.append(target);

	const component = mount(QueryClientProvider, {
		target,
		props: { client: queryClient, children: pageChild }
	});

	mounted = { component: component as Record<string, unknown>, target };

	return { target, component };
}

afterEach(() => {
	if (!mounted) return;

	unmount(mounted.component);
	mounted.target.remove();
	// Dialogs portal to the body; without this the next test sees two builders.
	document.body.replaceChildren();
	mounted = undefined;
});

/** The summary panel, where totals live. A slot shows the same figure. */
function summary(): HTMLElement {
	return screen.getByRole('region', { name: 'Your loadout' });
}

/** What the loader decided about `?loadout=`; each test can set it. */
let sharedData: { state: string; selections?: unknown[]; rejected?: unknown[] } = { state: 'none' };

// A snippet is the only way to nest a component under a provider from a test.
const pageChild = createPageSnippet();

function createPageSnippet() {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ((anchor: any) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(BuildPage as any)(anchor, {
			data: {
				sections: loadoutSections(),
				slotCount: LOADOUT_SLOTS.length,
				shared: sharedData
			},
			params: {},
			form: null
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any;
}

function priceRequests(): number {
	return fetchMock.mock.calls.filter((call) => String(call[0]) === '/api/build/prices').length;
}

/** Opens the AK-47 slot's picker and waits for its options. */
async function openAkPicker() {
	await fireEvent.click(screen.getByRole('button', { name: /Choose skin for the AK-47 slot/ }));

	return waitFor(() => screen.getByRole('dialog', { name: 'Choose a AK-47 skin' }));
}

async function chooseRedline(dialog: HTMLElement) {
	await waitFor(() => within(dialog).getByRole('button', { name: /Redline/ }));
	await fireEvent.click(within(dialog).getByRole('button', { name: /Redline/ }));
	await fireEvent.click(within(dialog).getByRole('button', { name: 'Add to loadout' }));
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('the builder shell', () => {
	it('renders the whole registry, grouped by category', () => {
		renderPage();

		expect(
			screen.getByRole('heading', { level: 1, name: 'Build your loadout' })
		).toBeInTheDocument();
		for (const section of loadoutSections()) {
			expect(screen.getByRole('heading', { name: section.label })).toBeInTheDocument();
		}
	});

	it('starts with every slot empty and none of them filled', async () => {
		renderPage();

		// Restoring briefly, then settled — rather than showing 0/37 and
		// jumping to a restored count a moment later.
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);
		expect(screen.getAllByRole('button', { name: /Choose skin/ })).toHaveLength(
			LOADOUT_SLOTS.length
		);
	});

	it('asks for nothing at all before the visitor acts', () => {
		renderPage();

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('choosing a skin', () => {
	it('loads options only when a slot is opened, and prices nothing', async () => {
		renderPage();

		await openAkPicker();
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());

		expect(fetchMock.mock.calls.every((call) => String(call[0]).includes('/api/build/skins'))).toBe(
			true
		);
		expect(priceRequests()).toBe(0);
	});

	it('scopes the request to the slot', async () => {
		renderPage();

		await openAkPicker();
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());

		expect(String(fetchMock.mock.calls[0][0])).toContain('slot=ak-47');
	});

	it('fills the slot and updates the count', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());

		expect(screen.getByText(`1 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
	});

	it('does not mutate the loadout when the picker is cancelled', async () => {
		renderPage();

		const dialog = await openAkPicker();
		await waitFor(() => within(dialog).getByRole('button', { name: /Redline/ }));
		await fireEvent.click(within(dialog).getByRole('button', { name: /Redline/ }));
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

		expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();
	});

	it('removes a selection without touching the others', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: /Remove Redline/ }));

		expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();
	});
});

describe('pricing', () => {
	it('sends nothing until the visitor asks', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());

		expect(priceRequests()).toBe(0);
		expect(screen.getByText('Prices not calculated yet.')).toBeInTheDocument();
	});

	it('prices on request and shows the total, per-item price and Steam comparison', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));

		await waitFor(() => expect(within(summary()).getByText('R$ 128,15')).toBeInTheDocument());

		expect(priceRequests()).toBe(1);
		expect(within(summary()).getByText('Steam total')).toBeInTheDocument();
		expect(within(summary()).getByText('R$ 21,85 lower than Steam')).toBeInTheDocument();
		// The slot carries the same figure plus where it came from.
		expect(screen.getAllByText('R$ 128,15')).toHaveLength(2);
		expect(screen.getByText('CSFloat')).toBeInTheDocument();
	});

	it('sends the selection in application identity, never a catalog id', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));
		await waitFor(() => expect(priceRequests()).toBe(1));

		const call = fetchMock.mock.calls.find((entry) => String(entry[0]) === '/api/build/prices');
		const body = JSON.parse(String(call?.[1]?.body));

		expect(body.selections).toEqual([
			{
				slotId: 'ak-47',
				skinSlug: 'ak-47-redline',
				variant: { wear: 'Factory New', edition: 'normal' }
			}
		]);
		expect(JSON.stringify(body)).not.toContain('101');
	});

	it('stops showing the total once the loadout changes', async () => {
		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));
		await waitFor(() => expect(within(summary()).getByText('R$ 128,15')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: /Remove Redline/ }));

		// An old total beside a changed loadout is not out of date, it is wrong.
		expect(screen.queryByText('R$ 128,15')).toBeNull();
		expect(priceRequests()).toBe(1);
	});

	it('shows the incomplete state without inventing a total', async () => {
		pricingResponse = pricingResult({
			items: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', state: 'no-quotes' }],
			total: undefined,
			steam: undefined,
			complete: false
		});

		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));

		await waitFor(() => expect(screen.getByText('Total unavailable')).toBeInTheDocument());
		expect(screen.getByText('1 selected item has no current price.')).toBeInTheDocument();
	});

	it('keeps the loadout when the price request fails', async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).startsWith('/api/build/skins')) {
				return new Response(JSON.stringify(AK_PAGE), {
					headers: { 'content-type': 'application/json' }
				});
			}

			return new Response(JSON.stringify({ error: 'nope' }), { status: 503 });
		});

		renderPage();

		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));

		await waitFor(() =>
			expect(within(summary()).getByText("Current prices couldn't be loaded.")).toBeInTheDocument()
		);
		expect(
			within(summary()).getByText(`1 / ${LOADOUT_SLOTS.length} slots filled`)
		).toBeInTheDocument();
	});
});

/** A resolved selection, as `/api/build/resolve` returns them. */
function resolvedAk(wear = 'Factory New') {
	return {
		slotId: 'ak-47',
		option: AK_PAGE.options[0],
		variant: { wear, edition: 'normal' as const }
	};
}

function resolvedAwp() {
	return {
		slotId: 'awp',
		option: {
			slug: 'awp-asiimov',
			weapon: 'AWP',
			name: 'Asiimov',
			fullName: 'AWP | Asiimov',
			variants: [{ itemId: 301, wear: 'Field-Tested', statTrak: false, souvenir: false }]
		},
		variant: { wear: 'Field-Tested', edition: 'normal' as const }
	};
}

/** What the resolve endpoint should answer with, per test. */
let resolveResponse: { selections: unknown[]; rejected: unknown[] } = {
	selections: [],
	rejected: []
};

function saved() {
	return localStorage.getItem(BUILDER_STORAGE_KEY);
}

function seedStorage(selections: unknown[]) {
	localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify({ version: 1, selections }));
}

beforeEach(() => {
	resolveResponse = { selections: [], rejected: [] };

	fetchMock.mockImplementation(async (url: string) => {
		if (String(url).startsWith('/api/build/skins')) {
			return new Response(JSON.stringify(AK_PAGE), {
				headers: { 'content-type': 'application/json' }
			});
		}

		if (String(url) === '/api/build/resolve') {
			return new Response(JSON.stringify(resolveResponse), {
				headers: { 'content-type': 'application/json' }
			});
		}

		if (String(url) === '/api/build/prices') {
			return new Response(JSON.stringify(pricingResponse), {
				headers: { 'content-type': 'application/json' }
			});
		}

		throw new Error(`unexpected fetch: ${url}`);
	});
});

describe('restoring a saved loadout', () => {
	it('asks for nothing when there is nothing saved', async () => {
		renderPage();

		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		expect(fetchMock.mock.calls.some((call) => String(call[0]) === '/api/build/resolve')).toBe(
			false
		);
	});

	it('restores what was saved, through the catalog', async () => {
		seedStorage([{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Factory New' } }]);
		resolveResponse = { selections: [resolvedAk()], rejected: [] };

		renderPage();

		await waitFor(() => expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument());
		expect(screen.getByText(`1 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();
	});

	it('never overwrites the save with the empty builder it starts as', async () => {
		// The bug this guards against would silently destroy loadouts.
		const original = JSON.stringify({
			version: 1,
			selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Factory New' } }]
		});
		localStorage.setItem(BUILDER_STORAGE_KEY, original);
		resolveResponse = { selections: [resolvedAk()], rejected: [] };

		renderPage();

		// Before restoration resolves, the builder is empty — and storage is
		// still exactly what it was.
		expect(saved()).toBe(original);

		await waitFor(() => expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument());
		expect(JSON.parse(saved()!).selections).toHaveLength(1);
	});

	it('reports selections that could not be restored', async () => {
		seedStorage([
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: {} },
			{ slotId: 'awp', skinSlug: 'awp-gone', variant: {} }
		]);
		resolveResponse = {
			selections: [resolvedAk()],
			rejected: [{ slotId: 'awp', reason: 'unknown-skin' }]
		};

		renderPage();

		await waitFor(() =>
			expect(
				screen.getByText(/Your loadout was restored, but 1 saved selection is no longer available/)
			).toBeInTheDocument()
		);
	});

	it('restores no pricing, whatever was on screen last time', async () => {
		seedStorage([{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Factory New' } }]);
		resolveResponse = { selections: [resolvedAk()], rejected: [] };

		renderPage();

		await waitFor(() => expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument());

		expect(within(summary()).getByText('Prices not calculated yet.')).toBeInTheDocument();
		expect(priceRequests()).toBe(0);
	});

	it('keeps the save when the catalog cannot be reached', async () => {
		const original = JSON.stringify({
			version: 1,
			selections: [{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: {} }]
		});
		localStorage.setItem(BUILDER_STORAGE_KEY, original);

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url) === '/api/build/resolve') {
				return new Response(JSON.stringify({ error: 'nope' }), { status: 503 });
			}

			return new Response(JSON.stringify(AK_PAGE), {
				headers: { 'content-type': 'application/json' }
			});
		});

		renderPage();

		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		// The loadout is probably still good; this session just could not load it.
		expect(saved()).toBe(original);
	});
});

describe('saving automatically', () => {
	it('saves a new selection without being asked', async () => {
		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		await chooseRedline(await openAkPicker());

		await waitFor(() => expect(saved()).not.toBeNull());
		expect(JSON.parse(saved()!)).toEqual({
			version: 1,
			selections: [
				{
					slotId: 'ak-47',
					skinSlug: 'ak-47-redline',
					variant: { wear: 'Factory New', edition: 'normal' }
				}
			]
		});
	});

	it('saves no market data when prices are checked', async () => {
		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		await chooseRedline(await openAkPicker());
		await waitFor(() => expect(saved()).not.toBeNull());

		const before = saved();
		await fireEvent.click(screen.getByRole('button', { name: 'Check current prices' }));
		await waitFor(() => expect(within(summary()).getByText('R$ 128,15')).toBeInTheDocument());

		expect(saved()).toBe(before);
		expect(saved()).not.toMatch(/price|currency|provider/i);
	});

	it('removes the save when the loadout is cleared', async () => {
		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		await chooseRedline(await openAkPicker());
		await waitFor(() => expect(saved()).not.toBeNull());

		await fireEvent.click(screen.getByRole('button', { name: 'Clear loadout' }));
		await fireEvent.click(
			screen.getAllByRole('button', { name: 'Clear loadout' }).at(-1) as HTMLElement
		);

		await waitFor(() => expect(saved()).toBeNull());
	});
});

describe('a shared loadout', () => {
	beforeEach(() => {
		sharedData = {
			state: 'loaded',
			selections: [resolvedAk('Field-Tested'), resolvedAwp()],
			rejected: []
		};
	});

	it('is displayed, marked as shared, and priced by nobody', () => {
		renderPage();

		expect(screen.getByText('Shared loadout')).toBeInTheDocument();
		expect(screen.getByText(`2 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();
		expect(within(summary()).getByText('Prices not calculated yet.')).toBeInTheDocument();
	});

	it('takes precedence over whatever this visitor had saved', async () => {
		seedStorage([{ slotId: 'knife', skinSlug: 'bayonet', variant: {} }]);

		renderPage();

		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Bayonet' })).toBeNull();
		// It did not even ask: reading the save would be pointless here.
		await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
	});

	it('leaves the visitor’s own save untouched while it is only viewed', async () => {
		const original = JSON.stringify({
			version: 1,
			selections: [{ slotId: 'knife', skinSlug: 'bayonet', variant: {} }]
		});
		localStorage.setItem(BUILDER_STORAGE_KEY, original);

		renderPage();
		await waitFor(() => expect(screen.getByText('Shared loadout')).toBeInTheDocument());

		expect(saved()).toBe(original);
	});

	it('becomes the visitor’s own, and is saved, on the first edit', async () => {
		localStorage.setItem(
			BUILDER_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				selections: [{ slotId: 'knife', skinSlug: 'bayonet', variant: {} }]
			})
		);

		renderPage();
		await fireEvent.click(screen.getByRole('button', { name: /Remove Asiimov/ }));

		await waitFor(() => expect(screen.queryByText('Shared loadout')).toBeNull());
		await waitFor(() =>
			expect(JSON.parse(saved()!).selections.map((s: { slotId: string }) => s.slotId)).toEqual([
				'ak-47'
			])
		);
	});

	it('shows how many of its selections could not be restored', () => {
		sharedData = {
			state: 'loaded',
			selections: [resolvedAk('Field-Tested')],
			rejected: [{ slotId: 'awp', reason: 'unknown-skin' }, { reason: 'unknown-slot' }]
		};

		renderPage();

		expect(screen.getByText(/2 saved selections are no longer available/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
	});

	it('says so calmly when the link could not be read at all', async () => {
		sharedData = { state: 'invalid' };

		renderPage();

		expect(screen.getByText('This shared loadout could not be loaded.')).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);
	});
});

describe('sharing', () => {
	it('offers nothing to share while the loadout is empty', async () => {
		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);

		expect(screen.queryByRole('button', { name: /Copy a link/ })).toBeNull();
	});

	it('copies an absolute link carrying the selections', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);
		await chooseRedline(await openAkPicker());

		await fireEvent.click(screen.getByRole('button', { name: /Copy a link/ }));

		await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

		const url = new URL(writeText.mock.calls[0][0]);
		expect(url.pathname).toBe('/build');
		expect(url.searchParams.get('loadout')).toMatch(/^v1\./);

		const decoded = decodeLoadout(url.searchParams.get('loadout')!);
		expect(decoded.ok && decoded.selections).toEqual([
			{
				slotId: 'ak-47',
				skinSlug: 'ak-47-redline',
				variant: { wear: 'Factory New', edition: 'normal' }
			}
		]);

		await waitFor(() =>
			expect(screen.getByText('Link copied to your clipboard.')).toBeInTheDocument()
		);
		vi.unstubAllGlobals();
		vi.stubGlobal('fetch', fetchMock);
	});

	it('does not change the address bar just to share', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);
		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: /Copy a link/ }));

		await waitFor(() => expect(writeText).toHaveBeenCalled());
		expect(replaceStateMock).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
		vi.stubGlobal('fetch', fetchMock);
	});

	it('falls back to a selectable field when the clipboard refuses', async () => {
		vi.stubGlobal('navigator', {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
		});

		renderPage();
		await waitFor(() =>
			expect(screen.getByText(`0 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument()
		);
		await chooseRedline(await openAkPicker());
		await fireEvent.click(screen.getByRole('button', { name: /Copy a link/ }));

		const field = await waitFor(() => screen.getByRole('textbox', { name: 'Share link' }));
		expect((field as HTMLInputElement).value).toContain('loadout=v1.');
		// Still a working builder.
		expect(screen.getByText(`1 / ${LOADOUT_SLOTS.length} slots filled`)).toBeInTheDocument();

		vi.unstubAllGlobals();
		vi.stubGlobal('fetch', fetchMock);
	});
});
