import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SmartLoadoutItem from './SmartLoadoutItem.svelte';
import type { GeneratedSmartItem } from '$lib/types/smart-loadout';

function item(overrides: Partial<GeneratedSmartItem> = {}): GeneratedSmartItem {
	return {
		entryId: 't-rifle',
		slotId: 'ak-47',
		slotLabel: 'AK-47',
		skinSlug: 'ak-47-redline',
		weapon: 'AK-47',
		skinName: 'Redline',
		fullName: 'AK-47 | Redline',
		imageUrl: 'https://cdn.example.test/redline.png',
		rarity: { name: 'Classified' },
		variant: { wear: 'Field-Tested', edition: 'normal' },
		priceMinor: 4250,
		currency: 'BRL',
		providerId: 'csfloat',
		providerName: 'CSFloat',
		match: 'color',
		...overrides
	};
}

function link(): HTMLAnchorElement {
	return screen.getByRole('link');
}

describe('what it shows', () => {
	it('names the slot, the finish and the exterior', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(screen.getByText('AK-47')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
		expect(screen.getByText('Field-Tested')).toBeInTheDocument();
	});

	it('formats the price in pt-BR from minor units', () => {
		render(SmartLoadoutItem, { item: item({ priceMinor: 128_15 }) });

		expect(screen.getByText('R$ 128,15')).toBeInTheDocument();
	});

	it('names the marketplace the price came from', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(screen.getByText('CSFloat')).toBeInTheDocument();
	});

	it('falls back to the provider key when the directory has no name', () => {
		render(SmartLoadoutItem, { item: item({ providerName: undefined }) });

		expect(screen.getByText('csfloat')).toBeInTheDocument();
	});

	it('shows the rarity from our own config, not an upstream colour', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(screen.getByText('Classified')).toBeInTheDocument();
	});

	it('uses the weapon name for a vanilla knife, which has no finish', () => {
		render(SmartLoadoutItem, {
			item: item({
				slotLabel: 'Knife',
				weapon: 'Karambit',
				skinName: '',
				fullName: 'Karambit',
				skinSlug: 'karambit'
			})
		});

		expect(screen.getByRole('link', { name: 'Karambit' })).toBeInTheDocument();
	});

	it('renders without an image or a rarity', () => {
		render(SmartLoadoutItem, {
			item: item({ imageUrl: undefined, rarity: undefined })
		});

		expect(screen.getByRole('link', { name: 'Redline' })).toBeInTheDocument();
	});
});

describe('the link', () => {
	it('opens the skin page at the exact variant that was priced', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(link()).toHaveAttribute('href', '/skins/ak-47-redline?wear=Field-Tested');
	});

	it('leaves the normal edition out, because it is the default', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(link().getAttribute('href')).not.toContain('edition');
	});

	it('carries a phase when the variant has one', () => {
		render(SmartLoadoutItem, {
			item: item({ variant: { wear: 'Factory New', edition: 'normal', phase: 'Phase 2' } })
		});

		expect(link()).toHaveAttribute(
			'href',
			'/skins/ak-47-redline?wear=Factory%20New&phase=Phase%202'
		);
	});

	it('carries a non-normal edition', () => {
		render(SmartLoadoutItem, {
			item: item({ variant: { wear: 'Field-Tested', edition: 'stattrak' } })
		});

		expect(link().getAttribute('href')).toContain('edition=stattrak');
	});

	it('drops the query entirely for a variant with no dimensions', () => {
		render(SmartLoadoutItem, { item: item({ variant: {} }) });

		expect(link()).toHaveAttribute('href', '/skins/ak-47-redline');
	});
});

describe('what it does not show', () => {
	it('offers no buy button, because a batch quote carries no tracked link', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(screen.queryAllByRole('button')).toHaveLength(0);
		expect(screen.getAllByRole('link')).toHaveLength(1);
	});

	it('calls the price nothing but a price', () => {
		render(SmartLoadoutItem, { item: item() });

		expect(document.body.textContent).not.toMatch(/average|market value|fair|last sale/i);
	});

	it('says nothing about float', () => {
		// Wear is the variant dimension; float itself stays out of the product.
		// Matched on the vocabulary rather than the word, because "CSFloat" is a
		// marketplace name and a legitimate thing to print.
		render(SmartLoadoutItem, { item: item() });

		expect(document.body.textContent).not.toMatch(
			/float value|float range|min float|max float|paint seed|pattern index|inspect/i
		);
	});
});
