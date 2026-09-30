import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import AppFooter from './AppFooter.svelte';
import { mainNav, site } from '$lib/config/site';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

describe('AppFooter', () => {
	it('is a contentinfo landmark describing the product', () => {
		render(AppFooter);

		expect(screen.getByRole('contentinfo')).toBeInTheDocument();
		expect(screen.getByText(site.description)).toBeInTheDocument();
	});

	it('repeats the main navigation under its own label', () => {
		render(AppFooter);

		const nav = screen.getByRole('navigation', { name: 'Footer' });

		for (const item of mainNav) {
			expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute(
				'href',
				item.href
			);
		}
	});

	it('invents no social, legal or contact links', () => {
		render(AppFooter);

		// None of those pages or accounts exist; linking to them would be a lie.
		const links = screen.getAllByRole('link');
		const hrefs = links.map((link) => link.getAttribute('href'));

		expect(hrefs.every((href) => href?.startsWith('/'))).toBe(true);
		expect(hrefs).toEqual(mainNav.map((item) => item.href));
	});
});
