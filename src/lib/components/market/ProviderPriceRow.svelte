<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import BestPriceBadge from './BestPriceBadge.svelte';
	import PriceDisplay from './PriceDisplay.svelte';
	import ProviderLogo from './ProviderLogo.svelte';
	import { cn } from '$lib/utils';
	import type { MarketProvider } from '$lib/types/provider';
	import type { MarketQuote } from '$lib/types/market';

	/**
	 * One marketplace's offer for one item.
	 *
	 * The price is that provider's current **lowest ask** — not an average, a
	 * last sale or a valuation — and the copy never suggests otherwise.
	 *
	 * The whole row becomes a link when the quote carries a tracked redirect,
	 * which is how a visitor actually leaves for the marketplace. When it does
	 * not, the row stays informational: a disabled button that explains nothing
	 * is worse than no button.
	 */
	let {
		quote,
		/** Resolved provider, for the display name and logo. */
		provider,
		/** Marks this row as the cheapest usable quote in the comparison. */
		best = false,
		class: className
	}: {
		quote: MarketQuote;
		provider?: MarketProvider;
		best?: boolean;
		class?: string;
	} = $props();

	// Falling back to the provider key keeps the row readable even if the
	// directory has not been loaded alongside the quotes.
	const name = $derived(provider?.name ?? quote.providerId);
	const linked = $derived(Boolean(quote.redirectUrl));
</script>

{#snippet body()}
	{#if provider}
		<ProviderLogo {provider} decorative />
	{/if}

	<span class="min-w-0 flex-1">
		<span class="block truncate text-sm font-medium text-foreground">{name}</span>
		{#if provider?.marketType}
			<span class="block truncate text-xs text-subtle-foreground">{provider.marketType}</span>
		{/if}
	</span>

	<span class="flex shrink-0 items-center gap-2">
		{#if best}
			<BestPriceBadge />
		{/if}
		<PriceDisplay amountMinor={quote.priceMinor} currency={quote.currency} size="sm" />
		{#if linked}
			<ExternalLinkIcon class="size-3.5 text-subtle-foreground" aria-hidden="true" />
		{/if}
	</span>
{/snippet}

{#if linked}
	<!--
		An external marketplace redirect owned by CS2Cap, not one of our routes,
		so `resolve()` does not apply here — it would corrupt the URL.
	-->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={quote.redirectUrl}
		target="_blank"
		rel="noopener noreferrer"
		class={cn(
			'flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:border-muted-foreground/40 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
			className
		)}
	>
		{@render body()}
		<span class="sr-only">(opens in a new tab)</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<div
		class={cn(
			'flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5',
			className
		)}
	>
		{@render body()}
	</div>
{/if}
