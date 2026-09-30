import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoadoutVariantPicker from './LoadoutVariantPicker.svelte';
import type { LoadoutSkinOption, LoadoutVariantOption } from '$lib/types/loadout';

function variant(
	itemId: number,
	wear: string,
	overrides: Partial<LoadoutVariantOption> = {}
): LoadoutVariantOption {
	return { itemId, wear, statTrak: false, souvenir: false, ...overrides };
}

function option(variants: LoadoutVariantOption[]): LoadoutSkinOption {
	return {
		slug: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		variants
	};
}

function props(variants: LoadoutVariantOption[], selection: Record<string, unknown> = {}) {
	return { option: option(variants), selection } as never;
}

describe('available options', () => {
	it('offers every exterior the skin actually has', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New'), variant(2, 'Field-Tested')])
		});

		const group = screen.getByRole('group', { name: 'Exterior' });

		expect(group.textContent).toContain('Factory New');
		expect(group.textContent).toContain('Field-Tested');
	});

	it('never offers an exterior the skin does not have', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New'), variant(2, 'Field-Tested')])
		});

		expect(screen.queryByRole('button', { name: 'Battle-Scarred' })).toBeNull();
	});

	it('offers the editions that exist, plain first', () => {
		render(LoadoutVariantPicker, {
			props: props([
				variant(1, 'Factory New'),
				variant(2, 'Factory New', { statTrak: true }),
				variant(3, 'Factory New', { souvenir: true })
			])
		});

		const group = screen.getByRole('group', { name: 'Edition' });
		const labels = [...group.querySelectorAll('button')].map((node) => node.textContent?.trim());

		expect(labels).toEqual(['Normal', 'StatTrak', 'Souvenir']);
	});

	it('offers phases for a phased finish', () => {
		render(LoadoutVariantPicker, {
			props: props([
				variant(1, 'Factory New', { phase: 'Phase 2' }),
				variant(2, 'Factory New', { phase: 'Phase 4' })
			])
		});

		expect(screen.getByRole('group', { name: 'Phase' })).toBeInTheDocument();
	});
});

describe('controls that would offer no choice', () => {
	it('shows no exterior control when there is only one', () => {
		render(LoadoutVariantPicker, { props: props([variant(1, 'Factory New')]) });

		expect(screen.queryByRole('group', { name: 'Exterior' })).toBeNull();
	});

	it('shows no edition control when the skin is only sold plain', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New'), variant(2, 'Field-Tested')])
		});

		expect(screen.queryByRole('group', { name: 'Edition' })).toBeNull();
	});

	it('shows no phase control for an unphased finish', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New'), variant(2, 'Field-Tested')])
		});

		expect(screen.queryByRole('group', { name: 'Phase' })).toBeNull();
	});

	it('says so plainly when there is nothing to choose', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New')], { wear: 'Factory New' })
		});

		expect(screen.getByText('Sold only as Factory New.')).toBeInTheDocument();
	});

	it('handles a variant with no exterior at all', () => {
		render(LoadoutVariantPicker, {
			props: props([{ itemId: 1, statTrak: false, souvenir: false }])
		});

		expect(screen.getByText('This skin has one version.')).toBeInTheDocument();
	});
});

describe('the current selection', () => {
	it('marks the selected exterior as pressed', () => {
		render(LoadoutVariantPicker, {
			props: props([variant(1, 'Factory New'), variant(2, 'Field-Tested')], {
				wear: 'Field-Tested'
			})
		});

		expect(screen.getByRole('button', { name: 'Field-Tested' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Factory New' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('shows no catalog item id anywhere', () => {
		const { container } = render(LoadoutVariantPicker, {
			props: props([variant(12632, 'Factory New'), variant(12633, 'Field-Tested')])
		});

		expect(container.textContent).not.toContain('12632');
	});
});
