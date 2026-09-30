<script lang="ts">
	import KitItemPriceRow from './KitItemPriceRow.svelte';
	import type { PricedKitItem } from '$lib/features/kits/pricing';
	import type { MarketProvider } from '$lib/types/provider';

	/**
	 * The skins a kit contains, in editorial order, with current prices.
	 *
	 * Each row links to that skin's page **at the variant the kit intends** and
	 * shows the cheapest current offer for that same variant — one identity all
	 * the way through.
	 */
	let {
		items,
		providers = []
	}: { items: readonly PricedKitItem[]; providers?: readonly MarketProvider[] } = $props();
</script>

<ul class="space-y-2">
	{#each items as priced (priced.item.variant.itemId)}
		<KitItemPriceRow {priced} {providers} />
	{/each}
</ul>
