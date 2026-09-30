import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import { Button } from './index.js';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
	it('renders a real <button> element, never a div', () => {
		render(Button, { props: { children: label('Compare prices') } });

		expect(screen.getByRole('button', { name: 'Compare prices' }).tagName).toBe('BUTTON');
	});

	it('renders an anchor when given an href', () => {
		render(Button, { props: { href: '/explore', children: label('Explore') } });

		expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore');
	});
});
