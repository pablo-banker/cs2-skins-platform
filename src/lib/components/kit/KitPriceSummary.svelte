<script lang="ts">
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { formatMoney } from '$lib/formatters/currency';
	import type { PurchasePlan, SteamComparison } from '$lib/features/kits/purchase-strategy';

	/**
	 * What the kit costs, at the top of the page.
	 *
	 * The first question a visitor has after "what is in it" is "what does it
	 * cost", so the total sits beside the kit rather than under every item.
	 *
	 * A total appears only when **every** item is priced. A figure assembled
	 * from four of five items looks exactly like a complete one, and nobody
	 * reading it could tell the difference — so when pricing is incomplete this
	 * says so, and says how many items are missing.
	 */
	let {
		plan,
		steam,
		/** Kit items with no usable price. Empty when the kit is fully priced. */
		unpricedCount = 0
	}: {
		plan?: PurchasePlan;
		steam?: SteamComparison;
		unpricedCount?: number;
	} = $props();

	// Only claim a saving when there is one. The lowest-price plan considers
	// Steam too, so this is normally positive — but a claim that depends on
	// "normally" is a claim waiting to be wrong.
	const saving = $derived(steam && steam.savingsMinor > 0 ? steam.savingsMinor : undefined);
</script>

<div class="space-y-4 rounded-lg border border-border bg-surface p-4">
	{#if plan}
		<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<PriceDisplay
				amountMinor={plan.totalMinor}
				currency={plan.currency}
				label="Lowest price"
				size="lg"
			/>

			{#if steam}
				<PriceDisplay
					amountMinor={steam.totalMinor}
					currency={steam.currency}
					label="Steam total"
					size="md"
					class="text-right"
				/>
			{/if}
		</div>

		{#if saving}
			<p class="text-sm font-medium text-success">
				{formatMoney(saving, steam?.currency ?? plan.currency)} lower than Steam
			</p>
		{/if}
	{:else}
		<div class="space-y-1">
			<p class="text-base font-semibold text-foreground">Total unavailable</p>
			<p class="text-sm text-muted-foreground">
				{#if unpricedCount === 1}
					1 item has no current price.
				{:else if unpricedCount > 1}
					{unpricedCount} items have no current price.
				{:else}
					<!-- Every item priced but the totals still do not add up —
						 currencies disagreed, which is a fault, not a market fact. -->
					Current prices could not be combined into a total.
				{/if}
			</p>
		</div>
	{/if}

	<p class="max-w-prose text-xs text-subtle-foreground">
		Totals use current lowest listed prices. Final checkout prices may differ because listings can
		change and marketplaces may apply fees or other charges.
	</p>
</div>
