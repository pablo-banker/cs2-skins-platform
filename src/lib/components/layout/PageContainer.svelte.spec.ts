import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import PageContainer from './PageContainer.svelte';

describe('PageContainer', () => {
	it('renders whatever it wraps', () => {
		render(PageContainer, {
			props: {
				children: createRawSnippet(() => ({ render: () => '<p>Page content</p>' }))
			}
		});

		expect(screen.getByText('Page content')).toBeInTheDocument();
	});

	it('accepts extra classes so callers can add their own layout', () => {
		const { container } = render(PageContainer, {
			props: {
				class: 'flex items-center',
				children: createRawSnippet(() => ({ render: () => '<span>x</span>' }))
			}
		});

		// The container owns the gutters and width cap; callers only add layout.
		expect(container.firstElementChild).toHaveClass('flex', 'items-center', 'mx-auto');
	});
});
