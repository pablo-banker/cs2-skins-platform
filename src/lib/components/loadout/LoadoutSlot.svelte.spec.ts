import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoadoutSlot from './LoadoutSlot.svelte';
import { getLoadoutSlot } from '$lib/config/loadout';
import type { LoadoutSkinOption, PricedLoadoutItem } from '$lib/types/loadout';
import type { SkinSelection } from '$lib/schemas/skin-detail';

const ak = getLoadoutSlot('ak-47')!;
const knife = getLoadoutSlot('knife')!;

function option(overrides: Partial<LoadoutSkinOption> = {}): LoadoutSkinOption {
	return {
		slug: 'ak-47-redline',
		weapon: 'AK-47',
		name: 'Redline',
		fullName: 'AK-47 | Redline',
		imageUrl: 'https://cdn.example.test/redline.png',
		rarity: { name: 'Classified' },
		variants: [
			{ itemId: 101, wear: 'Factory New', statTrak: false, souvenir: false },
			{ itemId: 102, wear: 'Field-Tested', statTrak: false, souvenir: false }
		],
		...overrides
	};
}

function props(overrides: Record<string, unknown> = {}) {
	return {
		config: ak,
		onchoose: vi.fn(),
		onremove: vi.fn(),
		...overrides
	} as never;
}

describe('an empty slot', () => {
	it('invites a choice by name', () => {
		render(LoadoutSlot, { props: props() });

		const button = screen.getByRole('button');

		expect(button).toHaveAccessibleName(/AK-47.*Choose skin.*AK-47 slot/s);
	});

	it('is a real control, not a disabled placeholder', () => {
		render(LoadoutSlot, { props: props() });

		expect(screen.getByRole('button')).toBeEnabled();
	});

	it('opens the picker when pressed', async () => {
		const onchoose = vi.fn();
		render(LoadoutSlot, { props: props({ onchoose }) });

		screen.getByRole('button').click();

		expect(onchoose).toHaveBeenCalledTimes(1);
	});

	it('shows no image and no price — nothing is loading', () => {
		const { container } = render(LoadoutSlot, { props: props() });

		expect(container.querySelector('img')).toBeNull();
		expect(container.textContent).not.toMatch(/R\$|Price/);
	});
});

describe('a filled slot', () => {
	const variant: SkinSelection = { wear: 'Field-Tested', edition: 'normal' };

	it('shows the slot, the finish and the exact variant', () => {
		render(LoadoutSlot, { props: props({ option: option(), variant }) });

		expect(screen.getByText('AK-47')).toBeInTheDocument();
		expect(screen.getByText('Redline')).toBeInTheDocument();
		expect(screen.getByText('Field-Tested')).toBeInTheDocument();
	});

	it('links the skin to its page at that exact variant', () => {
		render(LoadoutSlot, { props: props({ option: option(), variant }) });

		expect(screen.getByRole('link', { name: 'Redline' })).toHaveAttribute(
			'href',
			'/skins/ak-47-redline?wear=Field-Tested'
		);
	});

	it('links without a query when the kit takes the default variant', () => {
		render(LoadoutSlot, {
			props: props({ option: option(), variant: { wear: 'Factory New', edition: 'normal' } })
		});

		expect(screen.getByRole('link', { name: 'Redline' })).toHaveAttribute(
			'href',
			'/skins/ak-47-redline'
		);
	});

	it('offers Change and Remove as distinguishable controls', () => {
		render(LoadoutSlot, { props: props({ option: option(), variant }) });

		expect(screen.getByRole('button', { name: /Change AK-47 skin/ })).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Remove Redline from the AK-47 slot/ })
		).toBeInTheDocument();
	});

	it('does not nest its controls inside a link or another button', () => {
		const { container } = render(LoadoutSlot, { props: props({ option: option(), variant }) });

		for (const node of container.querySelectorAll('button')) {
			expect(node.closest('a')).toBeNull();
			expect(node.parentElement?.closest('button')).toBeNull();
		}
	});

	it('calls back on change and on remove', () => {
		const onchoose = vi.fn();
		const onremove = vi.fn();
		render(LoadoutSlot, { props: props({ option: option(), variant, onchoose, onremove }) });

		screen.getByRole('button', { name: /Change/ }).click();
		screen.getByRole('button', { name: /Remove/ }).click();

		expect(onchoose).toHaveBeenCalledTimes(1);
		expect(onremove).toHaveBeenCalledTimes(1);
	});

	it('shows StatTrak and a phase when the selection carries them', () => {
		render(LoadoutSlot, {
			props: props({
				option: option(),
				variant: { wear: 'Field-Tested', edition: 'stattrak', phase: 'Phase 2' }
			})
		});

		expect(screen.getByText('StatTrak')).toBeInTheDocument();
		expect(screen.getByText('Phase 2')).toBeInTheDocument();
	});

	it('names a vanilla knife by its weapon, which is its whole identity', () => {
		render(LoadoutSlot, {
			props: props({
				config: knife,
				option: option({ slug: 'bayonet', weapon: 'Bayonet', name: '', fullName: 'Bayonet' }),
				variant: {}
			})
		});

		expect(screen.getByRole('link', { name: 'Bayonet' })).toBeInTheDocument();
	});

	it('shows no price until prices have been calculated', () => {
		const { container } = render(LoadoutSlot, { props: props({ option: option(), variant }) });

		expect(container.textContent).not.toMatch(/R\$|No current prices|unavailable/);
	});
});

describe('a priced slot', () => {
	function priced(overrides: Partial<PricedLoadoutItem> = {}): PricedLoadoutItem {
		return {
			slotId: 'ak-47',
			skinSlug: 'ak-47-redline',
			state: 'priced',
			bestPriceMinor: 12815,
			currency: 'BRL',
			providerId: 'csfloat',
			providerName: 'CSFloat',
			...overrides
		};
	}

	it('shows the cheapest price and where it is', () => {
		render(LoadoutSlot, { props: props({ option: option(), price: priced() }) });

		expect(screen.getByText('R$ 128,15')).toBeInTheDocument();
		expect(screen.getByText('CSFloat')).toBeInTheDocument();
	});

	it('falls back to the provider key when the directory was unavailable', () => {
		render(LoadoutSlot, {
			props: props({ option: option(), price: priced({ providerName: undefined }) })
		});

		expect(screen.getByText('csfloat')).toBeInTheDocument();
	});

	it('says nothing is listed when the market answered with no offers', () => {
		render(LoadoutSlot, {
			props: props({
				option: option(),
				price: priced({ state: 'no-quotes', bestPriceMinor: undefined })
			})
		});

		expect(screen.getByText('No current prices')).toBeInTheDocument();
	});

	it('distinguishes a failed request from an empty market', () => {
		render(LoadoutSlot, {
			props: props({
				option: option(),
				price: priced({ state: 'error', bestPriceMinor: undefined })
			})
		});

		expect(screen.getByText('Price temporarily unavailable')).toBeInTheDocument();
		expect(screen.queryByText('No current prices')).toBeNull();
	});

	it('shows no marketplace offer link — that is the skin page’s job', () => {
		const { container } = render(LoadoutSlot, {
			props: props({ option: option(), price: priced() })
		});

		expect(container.textContent).not.toMatch(/View offer|Buy/);
		expect(container.querySelector('a[target="_blank"]')).toBeNull();
	});
});
