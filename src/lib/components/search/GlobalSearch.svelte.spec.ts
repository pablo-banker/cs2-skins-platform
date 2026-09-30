import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import GlobalSearch from './GlobalSearch.svelte';

// TanStack Query is exercised by its own library; what matters here is how the
// dialog renders each state, so the query result is driven directly.
const { queryState } = vi.hoisted(() => ({
	queryState: {
		data: undefined as unknown,
		isPending: false,
		isError: false,
		refetch: vi.fn()
	}
}));

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: () => queryState
}));

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		params?.slug ? route.replace('[slug]', params.slug) : route
}));

/** Opens the dialog the way a visitor would. */
async function openDialog() {
	await fireEvent.click(screen.getByRole('button', { name: 'Search skins' }));
	await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

/** Types into the command input, updating the bound value. */
async function typeQuery(value: string) {
	await fireEvent.input(screen.getByPlaceholderText('Search skins, e.g. Redline'), {
		target: { value }
	});
}

function result(slug: string, weapon: string, name: string) {
	return {
		slug,
		weapon,
		name,
		fullName: `${weapon} | ${name}`,
		imageUrl: undefined,
		rarity: { name: 'Classified' },
		representativeWear: 'Field-Tested'
	};
}

beforeEach(() => {
	queryState.data = undefined;
	queryState.isPending = false;
	queryState.isError = false;
	queryState.refetch.mockReset();
	gotoMock.mockReset();
	localStorage.clear();
});

describe('search trigger', () => {
	it('is a real button with an accessible name', () => {
		render(GlobalSearch);

		const trigger = screen.getByRole('button', { name: 'Search skins' });
		expect(trigger.tagName).toBe('BUTTON');
	});

	it('advertises the shortcut without relying on it for meaning', () => {
		render(GlobalSearch);

		expect(screen.getByRole('button', { name: 'Search skins' })).toHaveAttribute(
			'aria-keyshortcuts',
			'Control+K Meta+K'
		);
	});

	it('does not render the dialog until asked', () => {
		render(GlobalSearch);

		expect(screen.queryByRole('dialog')).toBeNull();
	});
});

describe('search dialog', () => {
	it('opens from the trigger with a search input', async () => {
		render(GlobalSearch);

		await openDialog();

		expect(screen.getByPlaceholderText('Search skins, e.g. Redline')).toBeInTheDocument();
	});

	it('opens with Control+K', async () => {
		render(GlobalSearch);

		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

		await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
	});

	it('opens with Meta+K', async () => {
		render(GlobalSearch);

		await fireEvent.keyDown(window, { key: 'k', metaKey: true });

		await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
	});

	it('leaves other shortcuts alone', async () => {
		render(GlobalSearch);

		// Control+Shift+K and Control+Alt+K belong to other things, and a bare
		// "k" must never steal a keystroke from someone typing.
		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true, shiftKey: true });
		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true, altKey: true });
		await fireEvent.keyDown(window, { key: 'k' });

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('invites a search rather than announcing no results', async () => {
		render(GlobalSearch);

		await openDialog();

		expect(screen.getByText('Search by weapon or skin name.')).toBeInTheDocument();
		expect(screen.queryByText(/No skins found/)).toBeNull();
	});

	it('offers recent selections when there are any', async () => {
		localStorage.setItem(
			'cs2skins.recent-skins',
			JSON.stringify([
				{ slug: 'ak-47-redline', weapon: 'AK-47', name: 'Redline', fullName: 'AK-47 | Redline' }
			])
		);

		render(GlobalSearch);
		await openDialog();

		expect(screen.getByText('Recent')).toBeInTheDocument();
		expect(screen.getByText('Redline')).toBeInTheDocument();
	});
});

describe('search states', () => {
	async function openWithQuery() {
		render(GlobalSearch);
		await openDialog();
		await typeQuery('redline');
	}

	it('renders results, and never a price', async () => {
		queryState.data = {
			query: 'redline',
			items: [result('ak-47-redline', 'AK-47', 'Redline'), result('awp-redline', 'AWP', 'Redline')],
			hasMore: false
		};

		await openWithQuery();

		await waitFor(() => expect(screen.getByText('Skins')).toBeInTheDocument());
		expect(screen.getByText('AK-47')).toBeInTheDocument();
		expect(screen.getByText('AWP')).toBeInTheDocument();
		// Search is a navigator, not a comparison view.
		expect(screen.queryByText(/R\$/)).toBeNull();
		expect(screen.queryByText('Price unavailable')).toBeNull();
	});

	it('links "view all" into Explore with the query', async () => {
		queryState.data = {
			query: 'redline',
			items: [result('ak-47-redline', 'AK-47', 'Redline')],
			hasMore: true
		};

		await openWithQuery();

		// Command items carry role="option" for the listbox pattern, which
		// overrides the anchor's implicit role — so match on the text and check
		// the element it belongs to is a real link. Polled, because the query
		// the href carries only settles after the debounce.
		await waitFor(() =>
			expect(screen.getByText(/View all results/).closest('a')).toHaveAttribute(
				'href',
				'/explore?q=redline'
			)
		);
	});

	it('says so plainly when nothing matched', async () => {
		queryState.data = { query: 'redline', items: [], hasMore: false };

		await openWithQuery();

		await waitFor(() => expect(screen.getByText(/No skins found for/)).toBeInTheDocument());
	});

	it('shows a restrained loading state', async () => {
		queryState.isPending = true;

		await openWithQuery();

		await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Searching'));
	});

	it('explains a failure without leaking anything, and offers a retry', async () => {
		queryState.isError = true;

		await openWithQuery();

		await waitFor(() =>
			expect(screen.getByText('Search is temporarily unavailable.')).toBeInTheDocument()
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(queryState.refetch).toHaveBeenCalled();

		const dialog = screen.getByRole('dialog');
		expect(dialog.textContent).not.toMatch(/CS2Cap|50\d|fetch/i);
	});
});
