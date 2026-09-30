import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoadoutSummary from './LoadoutSummary.svelte';
import type { LoadoutPricingResult } from '$lib/types/loadout';

function pricing(overrides: Partial<LoadoutPricingResult> = {}): LoadoutPricingResult {
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
		complete: true,
		fingerprint: 'ak-47:ak-47-redline:Field-Tested::',
		...overrides
	};
}

/** A loadout holding as many placeholder selections as `filled` claims. */
function loadoutOf(count: number) {
	return {
		selections: Array.from({ length: count }, (_, index) => ({
			slotId: `slot-${index}`,
			skinSlug: `skin-${index}`,
			variant: {}
		}))
	};
}

function props(overrides: Record<string, unknown> = {}) {
	const filled = (overrides.filled as number) ?? 1;

	return {
		loadout: loadoutOf(filled),
		filled,
		total: 37,
		status: 'idle',
		hydration: 'ready',
		origin: filled > 0 ? 'local' : 'empty',
		shareOrigin: 'https://cs2skins.test',
		oncalculate: vi.fn(),
		onclear: vi.fn(),
		...overrides
	} as never;
}

describe('progress', () => {
	it('counts filled slots against the registry, as a count not a score', () => {
		render(LoadoutSummary, { props: props({ filled: 12, total: 37 }) });

		expect(screen.getByText('12 / 37 slots filled')).toBeInTheDocument();
		// No percentage, no grade, no badge.
		expect(screen.queryByText(/%/)).toBeNull();
	});
});

describe('pricing status', () => {
	it('says prices are not calculated before anything is asked for', () => {
		render(LoadoutSummary, { props: props() });

		expect(screen.getByText('Prices not calculated yet.')).toBeInTheDocument();
	});

	it('invites a selection when the loadout is empty and cannot be priced', () => {
		render(LoadoutSummary, { props: props({ filled: 0 }) });

		expect(screen.getByText('Choose a skin to price your loadout.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Check current prices/ })).toBeDisabled();
	});

	it('enables the action once something is selected', () => {
		render(LoadoutSummary, { props: props() });

		expect(screen.getByRole('button', { name: /Check current prices/ })).toBeEnabled();
	});

	it('asks for prices when the action is used', () => {
		const oncalculate = vi.fn();
		render(LoadoutSummary, { props: props({ oncalculate }) });

		screen.getByRole('button', { name: /Check current prices/ }).click();

		expect(oncalculate).toHaveBeenCalledTimes(1);
	});

	it('disables the action while a request is in flight', () => {
		render(LoadoutSummary, { props: props({ status: 'loading' }) });

		expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
		expect(screen.getByText('Checking current prices…')).toBeInTheDocument();
	});

	it('announces the status in words, not by colour alone', () => {
		const { container } = render(LoadoutSummary, { props: props({ status: 'stale' }) });

		expect(container.querySelector('[aria-live="polite"]')?.textContent).toMatch(
			/Prices need updating/
		);
	});
});

describe('totals', () => {
	it('shows the lowest total and the Steam comparison', () => {
		render(LoadoutSummary, {
			props: props({
				status: 'ready',
				pricing: pricing({
					total: { priceMinor: 50000, currency: 'BRL' },
					steam: { totalMinor: 62000, currency: 'BRL', savingsMinor: 12000 }
				})
			})
		});

		expect(screen.getByText('R$ 500,00')).toBeInTheDocument();
		expect(screen.getByText('Steam total')).toBeInTheDocument();
		expect(screen.getByText('R$ 120,00 lower than Steam')).toBeInTheDocument();
	});

	it('omits the Steam line when there is no complete Steam coverage', () => {
		render(LoadoutSummary, { props: props({ status: 'ready', pricing: pricing() }) });

		expect(screen.queryByText('Steam total')).toBeNull();
		expect(screen.queryByText(/lower than Steam/)).toBeNull();
	});

	it('claims no saving when Steam is not cheaper', () => {
		render(LoadoutSummary, {
			props: props({
				status: 'ready',
				pricing: pricing({
					steam: { totalMinor: 50000, currency: 'BRL', savingsMinor: 0 }
				})
			})
		});

		expect(screen.queryByText(/lower than Steam/)).toBeNull();
	});

	it('withholds the total when a selected item has no price', () => {
		render(LoadoutSummary, {
			props: props({
				status: 'ready',
				pricing: pricing({
					items: [
						{ slotId: 'ak-47', skinSlug: 'ak-47-redline', state: 'no-quotes' },
						{
							slotId: 'awp',
							skinSlug: 'awp-asiimov',
							state: 'priced',
							bestPriceMinor: 50000,
							currency: 'BRL'
						}
					],
					total: undefined,
					complete: false
				})
			})
		});

		expect(screen.getByText('Total unavailable')).toBeInTheDocument();
		expect(screen.getByText('1 selected item has no current price.')).toBeInTheDocument();
		// A subtotal of what did price would look exactly like a full total.
		expect(screen.queryByText('R$ 500,00')).toBeNull();
	});

	it('explains that the total covers selected skins, not every slot', () => {
		const { container } = render(LoadoutSummary, {
			props: props({ status: 'ready', pricing: pricing() })
		});

		expect(container.textContent).toMatch(/for the skins you have selected — not for every slot/);
	});

	it('shows no total at all when the calculation failed', () => {
		const { container } = render(LoadoutSummary, { props: props({ status: 'error' }) });

		expect(screen.getByText("Current prices couldn't be loaded.")).toBeInTheDocument();
		expect(container.textContent).not.toMatch(/R\$/);
	});
});

describe('clearing', () => {
	it('offers nothing to clear when the loadout is empty', () => {
		render(LoadoutSummary, { props: props({ filled: 0 }) });

		expect(screen.queryByRole('button', { name: 'Clear loadout' })).toBeNull();
	});

	it('confirms before clearing, because nothing is saved yet', () => {
		const onclear = vi.fn();
		render(LoadoutSummary, { props: props({ filled: 3, onclear }) });

		screen.getByRole('button', { name: 'Clear loadout' }).click();

		expect(onclear).not.toHaveBeenCalled();
	});

	it('leaves the loadout alone when the confirmation is declined', async () => {
		const onclear = vi.fn();
		render(LoadoutSummary, { props: props({ filled: 3, onclear }) });

		screen.getByRole('button', { name: 'Clear loadout' }).click();
		await Promise.resolve();

		screen.getByRole('button', { name: 'Keep loadout' }).click();

		expect(onclear).not.toHaveBeenCalled();
	});

	it('clears once confirmed', async () => {
		const onclear = vi.fn();
		render(LoadoutSummary, { props: props({ filled: 3, onclear }) });

		screen.getByRole('button', { name: 'Clear loadout' }).click();
		await Promise.resolve();

		// A plain Dialog: shadcn's AlertDialog primitive is not vendored in this
		// project, and adding a dependency for one confirmation is not worth it.
		expect(screen.getByRole('dialog', { name: /Clear your loadout/ })).toBeInTheDocument();

		screen.getAllByRole('button', { name: 'Clear loadout' }).at(-1)?.click();

		expect(onclear).toHaveBeenCalledTimes(1);
	});
});

describe('clearing a shared loadout someone is only viewing', () => {
	it('warns that it will replace what is saved on this device', async () => {
		// Clearing counts as adopting, so the empty result becomes the save.
		// Someone clearing a link they were only looking at would not expect to
		// lose their own loadout.
		render(LoadoutSummary, {
			props: props({ filled: 2, origin: 'shared', hasLocalSave: true })
		});

		screen.getByRole('button', { name: 'Clear loadout' }).click();
		await Promise.resolve();

		expect(
			screen.getByText(/will also replace the loadout saved on this device/)
		).toBeInTheDocument();
	});

	it('says the ordinary thing when there is no local save to lose', async () => {
		render(LoadoutSummary, {
			props: props({ filled: 2, origin: 'shared', hasLocalSave: false })
		});

		screen.getByRole('button', { name: 'Clear loadout' }).click();
		await Promise.resolve();

		expect(screen.queryByText(/will also replace/)).toBeNull();
		expect(screen.getByText(/removes all 2 selected skins/)).toBeInTheDocument();
	});

	it('says the ordinary thing for the visitor’s own loadout', async () => {
		render(LoadoutSummary, {
			props: props({ filled: 2, origin: 'local', hasLocalSave: true })
		});

		screen.getByRole('button', { name: 'Clear loadout' }).click();
		await Promise.resolve();

		expect(screen.queryByText(/will also replace/)).toBeNull();
	});
});
