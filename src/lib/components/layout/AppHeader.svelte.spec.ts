import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import AppHeader from './AppHeader.svelte';
import { mainNav, site } from '$lib/config/site';

// `$app/state` is a SvelteKit runtime module; the tests own the current URL so
// active-route behaviour can be exercised.
const { mockPage } = vi.hoisted(() => ({
	mockPage: { url: new URL('http://localhost/') }
}));

vi.mock('$app/state', () => ({ page: mockPage }));

// The header composes global search; its query behaviour has its own tests.
vi.mock('@tanstack/svelte-query', () => ({
	createQuery: () => ({ data: undefined, isPending: false, isError: false, refetch: vi.fn() })
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

beforeEach(() => {
	mockPage.url = new URL('http://localhost/');
});

describe('AppHeader', () => {
	it('is a banner landmark', () => {
		render(AppHeader);

		expect(screen.getByRole('banner')).toBeInTheDocument();
	});

	it('links the brand back to home', () => {
		render(AppHeader);

		expect(screen.getByRole('link', { name: site.name })).toHaveAttribute('href', '/');
	});

	it('renders every navigation entry with its real href', () => {
		render(AppHeader);

		const nav = screen.getByRole('navigation', { name: 'Main' });

		for (const item of mainNav) {
			expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute(
				'href',
				item.href
			);
		}
	});

	it('offers the mobile menu as a real button with an accessible name', () => {
		render(AppHeader);

		const trigger = screen.getByRole('button', { name: 'Open menu' });

		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('marks the current section as the current page', () => {
		mockPage.url = new URL('http://localhost/explore');
		render(AppHeader);

		const nav = screen.getByRole('navigation', { name: 'Main' });

		expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(within(nav).getByRole('link', { name: 'Kits' })).not.toHaveAttribute('aria-current');
	});

	it('keeps the section current on a nested route', () => {
		// A skin page is still "Explore" to the visitor.
		mockPage.url = new URL('http://localhost/explore/ak-47-redline');
		render(AppHeader);

		const nav = screen.getByRole('navigation', { name: 'Main' });

		expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	it('marks nothing as current on home, which the brand link owns', () => {
		render(AppHeader);

		const nav = screen.getByRole('navigation', { name: 'Main' });

		for (const item of mainNav) {
			expect(within(nav).getByRole('link', { name: item.label })).not.toHaveAttribute(
				'aria-current'
			);
		}
	});

	it('offers global search', () => {
		render(AppHeader);

		expect(screen.getByRole('button', { name: 'Search skins' })).toBeInTheDocument();
	});

	it('has no authentication controls', () => {
		render(AppHeader);

		// Accounts are out of scope; a dead control is worse than none.
		expect(screen.queryByRole('button', { name: /sign in|log in|account|profile/i })).toBeNull();
	});
});
