import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import SmartLoadoutPage from './+page.svelte';
import { SMART_CORE } from '$lib/config/smart-loadout';
import { decodeLoadout, SHARE_PARAM } from '$lib/features/loadout/share';
import type {
	GeneratedSmartItem,
	GeneratedSmartLoadout,
	SmartAvailability,
	SmartGenerationResult
} from '$lib/types/smart-loadout';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/smart-loadout'), state: {} }
}));

const AVAILABILITY: SmartAvailability = {
	colors: ['red', 'blue', 'black'],
	styles: ['clean', 'dark'],
	colorsWithoutKnife: ['blue'],
	colorsWithoutGloves: ['black']
};

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

function loadout(overrides: Partial<GeneratedSmartLoadout> = {}): GeneratedSmartLoadout {
	const items = overrides.items ?? [
		item(),
		item({
			entryId: 't-pistol',
			slotId: 'glock-18',
			slotLabel: 'Glock-18',
			skinSlug: 'glock-18-candy-apple',
			weapon: 'Glock-18',
			skinName: 'Candy Apple',
			fullName: 'Glock-18 | Candy Apple',
			priceMinor: 1250
		})
	];

	return {
		preferences: { budgetMinor: 200_000, color: 'red', includeKnife: false, includeGloves: false },
		items,
		selections: items.map((entry) => ({
			slotId: entry.slotId,
			skinSlug: entry.skinSlug,
			variant: { wear: entry.variant.wear }
		})),
		totalMinor: items.reduce((sum, entry) => sum + entry.priceMinor, 0),
		budgetMinor: 200_000,
		remainingMinor: 200_000 - items.reduce((sum, entry) => sum + entry.priceMinor, 0),
		currency: 'BRL',
		partialStyleMatch: false,
		...overrides
	};
}

function props(availability: SmartAvailability = AVAILABILITY) {
	return {
		data: {
			availability,
			colorLabels: { red: 'Red', blue: 'Blue', black: 'Black' },
			styleLabels: { clean: 'Clean', dark: 'Dark' },
			core: SMART_CORE.map((entry) => ({
				id: entry.id,
				label: entry.label,
				optional: entry.optional
			}))
		},
		params: {},
		form: null
	} as unknown as ComponentProps<typeof SmartLoadoutPage>;
}

const fetchMock = vi.fn();
let response: SmartGenerationResult;

beforeEach(() => {
	response = { status: 'generated', loadout: loadout() };
	fetchMock.mockReset();
	fetchMock.mockImplementation(async (url: string) => {
		if (String(url) !== '/api/smart-loadout/generate') throw new Error(`unexpected: ${url}`);

		return new Response(JSON.stringify(response), {
			headers: { 'content-type': 'application/json' }
		});
	});

	vi.stubGlobal('fetch', fetchMock);
});

function budgetInput(): HTMLInputElement {
	return screen.getByLabelText('Maximum budget');
}

function generateButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: /generate loadout/i });
}

/** The body sent with the last generation request. */
function lastRequest(): Record<string, unknown> {
	const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];

	return JSON.parse(String(init.body));
}

describe('the form', () => {
	it('offers only the colours and styles that can produce a loadout', () => {
		render(SmartLoadoutPage, props());

		const colors = screen.getByLabelText('Colour') as HTMLSelectElement;
		const styles = screen.getByLabelText('Style') as HTMLSelectElement;

		expect([...colors.options].map((option) => option.value)).toEqual(['', 'red', 'blue', 'black']);
		expect([...styles.options].map((option) => option.value)).toEqual(['', 'clean', 'dark']);
	});

	it('names colours and styles with the shared taxonomy labels', () => {
		render(SmartLoadoutPage, props());

		const colors = screen.getByLabelText('Colour') as HTMLSelectElement;

		expect([...colors.options].map((option) => option.textContent?.trim())).toContain('Red');
	});

	it('cannot generate without a colour or a style', () => {
		render(SmartLoadoutPage, props());

		expect(generateButton()).toBeDisabled();
		expect(screen.getByText('Choose a colour or a style to generate.')).toBeInTheDocument();
	});

	it('cannot generate without a readable budget', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
		expect(generateButton()).toBeEnabled();

		await fireEvent.input(budgetInput(), { target: { value: 'lots' } });

		expect(generateButton()).toBeDisabled();
		expect(screen.getByText(/Enter an amount, for example/)).toBeInTheDocument();
	});

	it('reads a pt-BR budget into exact minor units', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.input(budgetInput(), { target: { value: 'R$ 1.234,56' } });
		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
		await fireEvent.click(generateButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(lastRequest().budgetMinor).toBe(123_456);
	});

	it('calls the shape, and only the shape, the endpoint accepts', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
		await fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'dark' } });
		await fireEvent.click(screen.getByLabelText('Include a knife'));
		await fireEvent.click(generateButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());

		// No slot, no candidate, no item id — the server owns all of that.
		expect(Object.keys(lastRequest()).sort()).toEqual([
			'budgetMinor',
			'color',
			'includeGloves',
			'includeKnife',
			'style'
		]);
		expect(lastRequest()).toMatchObject({ color: 'red', style: 'dark', includeKnife: true });
	});

	it('generates once per press, not per keystroke', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
		await fireEvent.input(budgetInput(), { target: { value: 'R$ 2.500,00' } });
		await fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'dark' } });

		expect(fetchMock).not.toHaveBeenCalled();

		await fireEvent.click(generateButton());
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	});

	it('warns before a generation is spent on an extra that has no match', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'blue' } });
		await fireEvent.click(screen.getByLabelText('Include a knife'));

		expect(screen.getByText(/No curated Blue knife yet/)).toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('warns about gloves separately from the knife', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'black' } });
		await fireEvent.click(screen.getByLabelText('Include gloves'));

		expect(screen.getByText(/No curated Black gloves yet/)).toBeInTheDocument();
		expect(screen.queryByText(/knife yet/)).not.toBeInTheDocument();
	});

	it('does not warn for a colour that has both', async () => {
		render(SmartLoadoutPage, props());

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
		await fireEvent.click(screen.getByLabelText('Include a knife'));
		await fireEvent.click(screen.getByLabelText('Include gloves'));

		expect(screen.queryByText(/No curated/)).not.toBeInTheDocument();
	});
});

/** Generates with a colour, the shortest path to a rendered result. */
async function generate(overrides?: () => Promise<void>) {
	render(SmartLoadoutPage, props());

	await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });
	await overrides?.();
	await fireEvent.click(generateButton());
	await waitFor(() => expect(fetchMock).toHaveBeenCalled());
}

describe('a generated loadout', () => {
	it('lists every chosen skin with its exterior and price', async () => {
		await generate();

		const result = await screen.findByRole('region', { name: 'Your Smart Loadout' });

		expect(result).toHaveTextContent('Redline');
		expect(result).toHaveTextContent('Candy Apple');
		expect(result).toHaveTextContent('Field-Tested');
		expect(result).toHaveTextContent('R$ 42,50');
		expect(result).toHaveTextContent('R$ 12,50');
	});

	it('shows the total, the budget and what is left', async () => {
		await generate();

		const result = await screen.findByRole('region', { name: 'Your Smart Loadout' });

		expect(result).toHaveTextContent('R$ 55,00');
		expect(result).toHaveTextContent('R$ 2.000,00');
		expect(result).toHaveTextContent('R$ 1.945,00');
	});

	it('names the direction it answered', async () => {
		await generate();

		expect(await screen.findByText(/^Red · 2 skins$/)).toBeInTheDocument();
	});

	it('says which marketplace each price came from', async () => {
		await generate();

		// One per item: the price and the marketplace it came from travel
		// together, because a total built from two providers is not one offer.
		expect(await screen.findAllByText('CSFloat')).toHaveLength(2);
	});

	it('says a price is a snapshot, not a promise', async () => {
		await generate();

		expect(
			await screen.findByText(/lowest current listings at the time of generating/)
		).toBeInTheDocument();
	});

	it('shows a Steam comparison when there is one', async () => {
		response = {
			status: 'generated',
			loadout: loadout({ steam: { totalMinor: 7000, currency: 'BRL', savingsMinor: 1500 } })
		};

		await generate();

		expect(await screen.findByText('R$ 15,00 lower than Steam')).toBeInTheDocument();
	});

	it('claims no saving when Steam is cheaper', async () => {
		response = {
			status: 'generated',
			loadout: loadout({ steam: { totalMinor: 4000, currency: 'BRL', savingsMinor: -1500 } })
		};

		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });
		expect(screen.queryByText(/lower than Steam/)).not.toBeInTheDocument();
	});

	it('admits when a style could not be matched everywhere', async () => {
		response = { status: 'generated', loadout: loadout({ partialStyleMatch: true }) };

		await generate();

		expect(await screen.findByText(/closest curated colour match/)).toBeInTheDocument();
	});

	it('stays quiet about styles when every slot matched', async () => {
		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });
		expect(screen.queryByText(/closest curated colour match/)).not.toBeInTheDocument();
	});

	it('hands the loadout to the builder as an ordinary share link', async () => {
		await generate();

		const link = await screen.findByRole('link', { name: 'Open in Builder' });
		const href = link.getAttribute('href') ?? '';

		expect(href).toContain('/build?');

		const payload = new URL(href, 'http://localhost').searchParams.get(SHARE_PARAM) ?? '';
		const decoded = decodeLoadout(payload);

		expect(decoded.ok).toBe(true);
		// Registry order, not generation order: the codec canonicalises, so the
		// same loadout always produces the same link.
		expect(decoded.ok && decoded.selections).toEqual([
			{ slotId: 'glock-18', skinSlug: 'glock-18-candy-apple', variant: { wear: 'Field-Tested' } },
			{ slotId: 'ak-47', skinSlug: 'ak-47-redline', variant: { wear: 'Field-Tested' } }
		]);
	});

	it('keeps a total out of the page metadata', async () => {
		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });

		const description = document.head.querySelector('meta[name="description"]');

		expect(description?.getAttribute('content')).not.toMatch(/R\$|\d{2,}/);
	});
});

describe('changed preferences', () => {
	it('stops showing a loadout that answers an older question', async () => {
		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'blue' } });

		expect(screen.queryByRole('region', { name: 'Your Smart Loadout' })).not.toBeInTheDocument();
		expect(screen.getByText(/Your choices changed — generate again/)).toBeInTheDocument();
	});

	it('drops it for a changed budget too', async () => {
		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });

		await fireEvent.input(budgetInput(), { target: { value: 'R$ 50,00' } });

		expect(screen.queryByRole('region', { name: 'Your Smart Loadout' })).not.toBeInTheDocument();
	});

	it('shows it again when the inputs come back', async () => {
		await generate();

		await screen.findByRole('region', { name: 'Your Smart Loadout' });

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'blue' } });
		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'red' } });

		expect(screen.getByRole('region', { name: 'Your Smart Loadout' })).toBeInTheDocument();
	});

	it('does not re-request while the inputs change', async () => {
		await generate();

		await fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'blue' } });
		await fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'dark' } });

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('when it cannot generate', () => {
	it('blames our curation, not the visitor, for a visual gap', async () => {
		response = { status: 'failed', reason: 'no-visual-candidates' };

		await generate();

		expect(await screen.findByText('Not enough curated matches yet')).toBeInTheDocument();
	});

	it('names the amount the current options start at', async () => {
		response = {
			status: 'failed',
			reason: 'budget-too-low',
			minimumMinor: 177_079,
			currency: 'BRL'
		};

		await generate();

		expect(await screen.findByText('This budget is too low')).toBeInTheDocument();
		expect(screen.getByText('R$ 1.770,79')).toBeInTheDocument();
	});

	it('suggests dropping the extras when they are on', async () => {
		response = { status: 'failed', reason: 'budget-too-low', minimumMinor: 500_000 };

		await generate(async () => {
			await fireEvent.click(screen.getByLabelText('Include a knife'));
			await fireEvent.click(screen.getByLabelText('Include gloves'));
		});

		expect(await screen.findByText(/leaving out the\s+knife and gloves/)).toBeInTheDocument();
	});

	it('separates a pricing gap from a budget one', async () => {
		response = { status: 'failed', reason: 'no-priceable-candidates' };

		await generate();

		expect(await screen.findByText('Some slots have no current price')).toBeInTheDocument();
		expect(screen.queryByText('This budget is too low')).not.toBeInTheDocument();
	});

	it('says prices are unavailable for a market outage', async () => {
		response = { status: 'failed', reason: 'market-unavailable' };

		await generate();

		expect(await screen.findByText('Prices are unavailable')).toBeInTheDocument();
	});

	it('says nothing about the upstream when a request fails', async () => {
		fetchMock.mockResolvedValue(
			new Response('CS2Cap 429 rate limited', { status: 503, statusText: 'Service Unavailable' })
		);

		await generate();

		expect(await screen.findByText(/Smart Loadout is temporarily unavailable/)).toBeInTheDocument();
		expect(document.body.textContent).not.toMatch(/CS2Cap|429|503/);
	});

	it('survives the network disappearing', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));

		await generate();

		expect(await screen.findByText(/Smart Loadout is temporarily unavailable/)).toBeInTheDocument();
		expect(generateButton()).toBeEnabled();
	});

	it('offers no Open in Builder link for a failure', async () => {
		response = { status: 'failed', reason: 'no-visual-candidates' };

		await generate();

		await screen.findByText('Not enough curated matches yet');
		expect(screen.queryByRole('link', { name: 'Open in Builder' })).not.toBeInTheDocument();
	});
});
