<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import PurchaseProviderGroupCard from './PurchaseProviderGroup.svelte';
	import { formatMoney } from '$lib/formatters/currency';
	import type { KitPurchasePlans, PurchasePlan } from '$lib/features/kits/purchase-strategy';
	import type { MarketProvider } from '$lib/types/provider';

	/**
	 * How to buy the kit — two answers, one set of already-loaded quotes.
	 *
	 * **Lowest price** buys every skin wherever it is cheapest. **Fewer
	 * marketplaces** buys from as few marketplaces as possible and is cheapest
	 * within that. Switching between them is pure presentation: both plans were
	 * computed on the server from the same quotes, so nothing is fetched and
	 * nothing can change under the visitor.
	 *
	 * The comparison is stated, never recommended. Which trade a person wants —
	 * a few reais or a few fewer accounts — is not ours to decide.
	 */
	let {
		plans,
		providers = []
	}: { plans: KitPurchasePlans; providers?: readonly MarketProvider[] } = $props();

	let strategy = $state<'lowest-price' | 'fewer-marketplaces'>('lowest-price');

	const selected = $derived<PurchasePlan>(
		strategy === 'lowest-price' ? plans.lowestPrice : plans.fewerMarketplaces
	);

	const difference = $derived(plans.fewerMarketplaces.totalMinor - plans.lowestPrice.totalMinor);
</script>

{#snippet summary(plan: PurchasePlan)}
	<dl class="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 sm:max-w-sm">
		<div>
			<dt class="text-xs text-subtle-foreground">Total</dt>
			<dd class="font-mono text-lg font-medium text-foreground tabular-nums">
				{formatMoney(plan.totalMinor, plan.currency)}
			</dd>
		</div>
		<div>
			<dt class="text-xs text-subtle-foreground">Marketplaces</dt>
			<dd class="font-mono text-lg font-medium text-foreground tabular-nums">
				{plan.providerCount}
			</dd>
		</div>
	</dl>
{/snippet}

{#snippet groups(plan: PurchasePlan)}
	<!--
		Capped: a buying plan is a checklist, and a row stretched to 1440px
		leaves the price a hand-span away from the skin it belongs to.
	-->
	<div class="max-w-3xl space-y-3">
		{#each plan.groups as group (group.providerId)}
			<PurchaseProviderGroupCard {group} {providers} />
		{/each}
	</div>
{/snippet}

{#if plans.equivalent}
	<!--
		Identical total and identical marketplace count: two tabs showing the
		same plan would be a choice that is not a choice.
	-->
	<div class="space-y-4">
		{@render summary(plans.lowestPrice)}
		<p class="text-sm text-muted-foreground">
			The lowest-price plan already uses the fewest marketplaces.
		</p>
		{@render groups(plans.lowestPrice)}
	</div>
{:else}
	<Tabs.Root bind:value={strategy} class="space-y-4">
		<Tabs.List class="w-full sm:w-fit">
			<Tabs.Trigger value="lowest-price">Lowest price</Tabs.Trigger>
			<Tabs.Trigger value="fewer-marketplaces">Fewer marketplaces</Tabs.Trigger>
		</Tabs.List>

		{@render summary(selected)}

		<!--
			The factual difference between the two, in both dimensions. No
			"recommended" badge: the trade is the visitor's to make.
		-->
		<p class="text-sm text-muted-foreground">
			{#if strategy === 'lowest-price'}
				Fewer marketplaces costs
				<span class="font-mono tabular-nums">
					{formatMoney(Math.abs(difference), plans.fewerMarketplaces.currency)}
				</span>
				{difference >= 0 ? 'more' : 'less'} across
				{plans.fewerMarketplaces.providerCount}
				{plans.fewerMarketplaces.providerCount === 1 ? 'marketplace' : 'marketplaces'}.
			{:else}
				Lowest price saves
				<span class="font-mono tabular-nums">
					{formatMoney(Math.abs(difference), plans.lowestPrice.currency)}
				</span>
				across
				{plans.lowestPrice.providerCount}
				{plans.lowestPrice.providerCount === 1 ? 'marketplace' : 'marketplaces'}.
			{/if}
		</p>

		<Tabs.Content value="lowest-price">
			{@render groups(plans.lowestPrice)}
		</Tabs.Content>
		<Tabs.Content value="fewer-marketplaces">
			{@render groups(plans.fewerMarketplaces)}
		</Tabs.Content>
	</Tabs.Root>
{/if}
