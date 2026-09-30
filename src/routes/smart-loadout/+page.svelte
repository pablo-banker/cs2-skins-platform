<script lang="ts">
	import WandIcon from '@lucide/svelte/icons/wand-sparkles';
	import { page as appPage } from '$app/state';
	import { resolve } from '$app/paths';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import SmartLoadoutItem from '$lib/components/smart-loadout/SmartLoadoutItem.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formatMoney } from '$lib/formatters/currency';
	import { parseBudgetMinor } from '$lib/schemas/smart-loadout';
	import { shareUrl } from '$lib/features/loadout/share';
	import { pageTitle } from '$lib/config/site';
	import type { SmartGenerationResult } from '$lib/types/smart-loadout';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let budget = $state('R$ 2.000,00');
	let color = $state('');
	let style = $state('');
	let includeKnife = $state(false);
	let includeGloves = $state(false);

	let result = $state<SmartGenerationResult | undefined>(undefined);
	let generating = $state(false);
	let requestFailed = $state(false);

	const budgetMinor = $derived(parseBudgetMinor(budget));
	const hasPreference = $derived(Boolean(color || style));
	const canGenerate = $derived(Boolean(budgetMinor) && hasPreference && !generating);

	/**
	 * What the current inputs describe.
	 *
	 * A result stops being shown the moment the preferences behind it change —
	 * an old loadout beside new inputs is not out of date, it is answering a
	 * question nobody asked. Compared by fingerprint so no edit path has to
	 * remember to clear it.
	 */
	const fingerprint = $derived(
		`${budgetMinor ?? ''}|${color}|${style}|${includeKnife}|${includeGloves}`
	);
	let generatedFor = $state('');

	const current = $derived(result && generatedFor === fingerprint ? result : undefined);
	const loadout = $derived(current?.status === 'generated' ? current.loadout : undefined);

	// Warned before a generation is spent finding out, using the coverage the
	// loader already computed.
	const knifeUnavailable = $derived(
		includeKnife && Boolean(color) && data.availability.colorsWithoutKnife.includes(color as never)
	);
	const glovesUnavailable = $derived(
		includeGloves &&
			Boolean(color) &&
			data.availability.colorsWithoutGloves.includes(color as never)
	);

	const builderHref = $derived(
		loadout
			? (shareUrl({ selections: loadout.selections }, appPage.url.origin) ?? resolve('/build'))
			: resolve('/build')
	);

	const direction = $derived(
		[color && data.colorLabels[color], style && data.styleLabels[style]].filter(Boolean).join(' · ')
	);

	async function generate() {
		if (!canGenerate || !budgetMinor) return;

		generating = true;
		requestFailed = false;

		try {
			const response = await fetch('/api/smart-loadout/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					budgetMinor,
					color: color || undefined,
					style: style || undefined,
					includeKnife,
					includeGloves
				})
			});

			if (!response.ok) throw new Error('generate-failed');

			result = (await response.json()) as SmartGenerationResult;
			generatedFor = fingerprint;
		} catch {
			requestFailed = true;
			result = undefined;
		} finally {
			generating = false;
		}
	}

	// `new URL`, not concatenation: `resolve()` returns a path relative
	// to the current URL, so `origin + resolve(…)` yields `host./route`.
	const canonical = $derived(new URL(resolve('/smart-loadout'), appPage.url.origin).href);
</script>

<svelte:head>
	<title>{pageTitle('Smart Loadout')}</title>
	<meta
		name="description"
		content="Set a budget and a visual direction, and get a curated CS2 core loadout priced at current marketplace prices."
	/>
	<!-- No generated total in the metadata: it is current market data. -->
	<link rel="canonical" href={canonical} />
</svelte:head>

<PageContainer class="space-y-8">
	<header class="max-w-2xl space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Smart Loadout</h1>
		<p class="text-sm text-muted-foreground">
			Set a budget and a visual direction, and we'll put together a core loadout at current
			marketplace prices. Built from our curated skin collection, so it is a hand-checked selection
			rather than every skin in the game.
		</p>
	</header>

	<div class="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
		<form
			class="space-y-5 rounded-lg border border-border bg-surface p-4"
			onsubmit={(event) => {
				event.preventDefault();
				generate();
			}}
		>
			<div class="space-y-1.5">
				<label for="smart-budget" class="block text-sm font-medium text-foreground">
					Maximum budget
				</label>
				<Input id="smart-budget" bind:value={budget} inputmode="decimal" autocomplete="off" />
				<p class="text-xs text-subtle-foreground">
					{#if budget.trim() && !budgetMinor}
						Enter an amount, for example R$ 2.000,00.
					{:else}
						A ceiling, not a target — we won't spend it just because it is there.
					{/if}
				</p>
			</div>

			<div class="space-y-1.5">
				<label for="smart-color" class="block text-sm font-medium text-foreground">Colour</label>
				<select
					id="smart-color"
					bind:value={color}
					class="w-full rounded-md border border-border bg-surface-elevated p-2 text-sm text-foreground"
				>
					<option value="">Any colour</option>
					{#each data.availability.colors as value (value)}
						<option {value}>{data.colorLabels[value]}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-1.5">
				<label for="smart-style" class="block text-sm font-medium text-foreground">Style</label>
				<select
					id="smart-style"
					bind:value={style}
					class="w-full rounded-md border border-border bg-surface-elevated p-2 text-sm text-foreground"
				>
					<option value="">Any style</option>
					{#each data.availability.styles as value (value)}
						<option {value}>{data.styleLabels[value]}</option>
					{/each}
				</select>
				<p class="text-xs text-subtle-foreground">
					{#if !hasPreference}
						Choose a colour or a style to generate.
					{:else}
						Only directions we have curated matches for are listed.
					{/if}
				</p>
			</div>

			<fieldset class="space-y-2">
				<legend class="text-sm font-medium text-foreground">Extras</legend>

				<label class="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
					<input type="checkbox" bind:checked={includeKnife} class="size-4 accent-primary" />
					Include a knife
				</label>
				{#if knifeUnavailable}
					<p class="text-xs text-warning">
						No curated {data.colorLabels[color]} knife yet — try another colour or leave it out.
					</p>
				{/if}

				<label class="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
					<input type="checkbox" bind:checked={includeGloves} class="size-4 accent-primary" />
					Include gloves
				</label>
				{#if glovesUnavailable}
					<p class="text-xs text-warning">
						No curated {data.colorLabels[color]} gloves yet — try another colour or leave them out.
					</p>
				{/if}
			</fieldset>

			<Button type="submit" class="w-full" disabled={!canGenerate}>
				{#if generating}
					Generating…
				{:else}
					<WandIcon class="size-4" aria-hidden="true" />
					Generate loadout
				{/if}
			</Button>

			<p class="text-xs text-subtle-foreground" aria-live="polite">
				{#if generating}
					Checking current prices for the best matches…
				{:else if result && generatedFor !== fingerprint}
					Your choices changed — generate again to see a matching loadout.
				{/if}
			</p>
		</form>

		<div class="space-y-4">
			{#if requestFailed}
				<p class="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
					Smart Loadout is temporarily unavailable. Try again in a moment.
				</p>
			{:else if current?.status === 'failed'}
				<!--
					Four different problems, four different answers: a visual gap is
					our curation backlog, a pricing gap is the market, and a budget
					gap is the visitor's to decide about.
				-->
				<div class="space-y-2 rounded-lg border border-border bg-surface p-6">
					{#if current.reason === 'no-visual-candidates'}
						<p class="text-sm font-medium text-foreground">Not enough curated matches yet</p>
						<p class="text-sm text-muted-foreground">
							We don't have enough hand-checked skins for this direction to fill every slot. Try
							another colour or style.
						</p>
					{:else if current.reason === 'budget-too-low'}
						<p class="text-sm font-medium text-foreground">This budget is too low</p>
						<p class="text-sm text-muted-foreground">
							The current curated options for this direction start around
							<span class="font-mono tabular-nums">
								{formatMoney(current.minimumMinor ?? 0, current.currency ?? 'BRL')}
							</span>.
							{#if includeKnife || includeGloves}
								Raising the budget or leaving out the
								{includeKnife && includeGloves
									? 'knife and gloves'
									: includeKnife
										? 'knife'
										: 'gloves'} would help.
							{:else}
								Try raising the budget.
							{/if}
						</p>
					{:else if current.reason === 'no-priceable-candidates'}
						<p class="text-sm font-medium text-foreground">Some slots have no current price</p>
						<p class="text-sm text-muted-foreground">
							A few required slots have no marketplace prices right now. Try again later or adjust
							your options.
						</p>
					{:else}
						<p class="text-sm font-medium text-foreground">Prices are unavailable</p>
						<p class="text-sm text-muted-foreground">
							Current prices could not be loaded. Try again in a moment.
						</p>
					{/if}
				</div>
			{:else if loadout}
				<section class="space-y-4" aria-labelledby="smart-result-heading">
					<div class="space-y-3 rounded-lg border border-border bg-surface p-4">
						<div class="space-y-1">
							<h2 id="smart-result-heading" class="text-base font-semibold text-foreground">
								Your Smart Loadout
							</h2>
							<p class="text-sm text-muted-foreground">
								{direction} · {loadout.items.length}
								{loadout.items.length === 1 ? 'skin' : 'skins'}
							</p>
						</div>

						<dl class="grid grid-cols-2 gap-4 sm:grid-cols-3">
							<div>
								<dt class="text-xs text-subtle-foreground">Current total</dt>
								<dd>
									<PriceDisplay
										amountMinor={loadout.totalMinor}
										currency={loadout.currency}
										size="lg"
									/>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-subtle-foreground">Budget</dt>
								<dd class="font-mono text-sm text-muted-foreground tabular-nums">
									{formatMoney(loadout.budgetMinor, loadout.currency)}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-subtle-foreground">Remaining</dt>
								<dd class="font-mono text-sm text-muted-foreground tabular-nums">
									{formatMoney(loadout.remainingMinor, loadout.currency)}
								</dd>
							</div>
						</dl>

						{#if loadout.steam && loadout.steam.savingsMinor > 0}
							<p class="text-sm font-medium text-success">
								{formatMoney(loadout.steam.savingsMinor, loadout.steam.currency)} lower than Steam
							</p>
						{/if}

						{#if loadout.partialStyleMatch}
							<p class="text-xs text-muted-foreground">
								Some slots use the closest curated colour match where an exact style match isn't
								available yet.
							</p>
						{/if}

						<!--
							Handed to the builder through the ordinary share link, so it
							arrives as a shared loadout: shown, not adopted, and the
							visitor's own saved loadout is untouched until they edit it.
						-->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<Button href={builderHref} class="w-full sm:w-auto">Open in Builder</Button>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->

						<p class="text-xs text-subtle-foreground">
							Prices are the lowest current listings at the time of generating, and can change
							afterwards.
						</p>
					</div>

					<ul class="space-y-2">
						{#each loadout.items as item (item.entryId)}
							<SmartLoadoutItem {item} />
						{/each}
					</ul>
				</section>
			{:else}
				<div class="rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
					<p class="text-sm text-muted-foreground">
						Pick a direction and generate to see a loadout.
					</p>
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
