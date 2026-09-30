<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { formatMoney } from '$lib/formatters/currency';
	import type { LoadoutPricingResult } from '$lib/types/loadout';
	import type { PricingStatus } from '$lib/features/loadout/builder.svelte';

	/**
	 * What the current selections cost, on request.
	 *
	 * Pricing is **never automatic**. A loadout can hold dozens of skins and a
	 * request per edit would spend a metered quota on a loadout nobody had
	 * finished building — so the visitor asks, once, when they are ready.
	 *
	 * After any edit the previous answer stops being displayed. An old total
	 * beside a changed loadout is not out of date, it is wrong, and it looks
	 * exactly like a correct one.
	 */
	let {
		status,
		pricing,
		selectionCount,
		oncalculate
	}: {
		status: PricingStatus;
		/** Only ever the result for the current selections. */
		pricing?: LoadoutPricingResult;
		selectionCount: number;
		oncalculate: () => void;
	} = $props();

	const missing = $derived(pricing?.items.filter((item) => item.state !== 'priced').length ?? 0);
	const saving = $derived(
		pricing?.steam && pricing.steam.savingsMinor > 0 ? pricing.steam.savingsMinor : undefined
	);

	const action = $derived(status === 'ready' ? 'Check prices again' : 'Check current prices');
</script>

<div class="space-y-3">
	{#if pricing?.total}
		<PriceDisplay
			amountMinor={pricing.total.priceMinor}
			currency={pricing.total.currency}
			label="Lowest price"
			size="lg"
		/>

		{#if pricing.steam}
			<div class="space-y-1">
				<PriceDisplay
					amountMinor={pricing.steam.totalMinor}
					currency={pricing.steam.currency}
					label="Steam total"
					size="sm"
				/>
				{#if saving}
					<p class="text-sm font-medium text-success">
						{formatMoney(saving, pricing.steam.currency)} lower than Steam
					</p>
				{/if}
			</div>
		{/if}
	{:else if pricing}
		<div class="space-y-1">
			<p class="text-sm font-semibold text-foreground">Total unavailable</p>
			<p class="text-sm text-muted-foreground">
				{#if missing === 1}
					1 selected item has no current price.
				{:else if missing > 1}
					{missing} selected items have no current price.
				{:else}
					Current prices could not be combined into a total.
				{/if}
			</p>
		</div>
	{/if}

	<!--
		The status is words, not a colour: someone who cannot tell amber from
		grey still has to know whether the number above is current.
	-->
	<p class="text-sm text-muted-foreground" aria-live="polite">
		{#if selectionCount === 0}
			Choose a skin to price your loadout.
		{:else if status === 'loading'}
			Checking current prices…
		{:else if status === 'error'}
			Current prices couldn't be loaded.
		{:else if status === 'stale'}
			Prices need updating — your loadout changed.
		{:else if status === 'ready'}
			Prices are current for {selectionCount === 1 ? 'this selection' : 'these selections'}.
		{:else}
			Prices not calculated yet.
		{/if}
	</p>

	<Button
		class="w-full"
		disabled={selectionCount === 0 || status === 'loading'}
		onclick={oncalculate}
	>
		{status === 'loading' ? 'Checking…' : action}
	</Button>

	{#if pricing?.total}
		<p class="text-xs text-subtle-foreground">
			Totals use current lowest listed prices for the skins you have selected — not for every slot.
			Final checkout prices may differ because listings can change and marketplaces may apply fees
			or other charges.
		</p>
	{/if}
</div>
