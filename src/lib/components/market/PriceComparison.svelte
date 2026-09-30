<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import BestPriceBadge from './BestPriceBadge.svelte';
	import PriceDisplay from './PriceDisplay.svelte';
	import ProviderLogo from './ProviderLogo.svelte';
	import ProviderPriceRow from './ProviderPriceRow.svelte';
	import { DISPLAY_CURRENCY } from '$lib/formatters/currency';
	import type { MarketProvider } from '$lib/types/provider';
	import type { QuoteRow } from '$lib/features/skins/price-comparison';

	/**
	 * Marketplace prices for one variant.
	 *
	 * Receives quotes already joined with provider metadata and already sorted
	 * cheapest-first; it fetches nothing. Every figure is a provider's current
	 * **lowest ask** — not an average, a last sale or a valuation — and the copy
	 * never suggests otherwise.
	 */
	let {
		rows,
		best,
		bestProvider,
		failed = false,
		currency = DISPLAY_CURRENCY,
		updatedAt
	}: {
		rows: QuoteRow[];
		best?: QuoteRow;
		bestProvider?: MarketProvider;
		/** True when the price request failed, as opposed to returning nothing. */
		failed?: boolean;
		currency?: string;
		updatedAt?: string;
	} = $props();

	/** Coarse on purpose: upstream refreshes every few minutes, not every second. */
	const freshness = $derived.by(() => {
		if (!updatedAt) return undefined;

		const minutes = Math.round((Date.now() - new Date(updatedAt).getTime()) / 60_000);
		if (!Number.isFinite(minutes) || minutes < 0) return undefined;
		if (minutes < 1) return 'Updated just now';
		if (minutes < 60) return `Updated ${minutes} min ago`;

		const hours = Math.round(minutes / 60);
		return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
	});
</script>

<section class="space-y-4" aria-labelledby="prices-heading">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 id="prices-heading" class="text-base font-semibold text-foreground">Marketplace prices</h2>
		{#if freshness && rows.length > 0}
			<p class="text-xs text-subtle-foreground">{freshness}</p>
		{/if}
	</div>

	{#if failed}
		<p
			class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground"
		>
			Prices are temporarily unavailable.
		</p>
	{:else if rows.length === 0}
		<p
			class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground"
		>
			No current prices for this variant.
		</p>
	{:else}
		{#if best}
			<!--
				The one question the page exists to answer, answered first.
				Success green, because a best price is money saved — amber is
				reserved for navigation and primary actions.
			-->
			<div class="rounded-lg border border-success/30 bg-success-subtle/40 p-4">
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div class="space-y-1.5">
						<BestPriceBadge />
						<PriceDisplay
							amountMinor={best.quote.priceMinor}
							currency={best.quote.currency}
							size="lg"
						/>
						<div class="flex items-center gap-2">
							{#if bestProvider}
								<ProviderLogo provider={bestProvider} decorative class="size-5" />
							{/if}
							<span class="text-sm text-muted-foreground">
								{bestProvider?.name ?? best.quote.providerId}
							</span>
						</div>
					</div>

					{#if best.quote.redirectUrl}
						<!--
							An external marketplace redirect owned by CS2Cap, not one of
							our routes, so `resolve()` does not apply — it would corrupt
							the URL.
						-->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={best.quote.redirectUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							View offer
							<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
							<span class="sr-only"
								>at {bestProvider?.name ?? best.quote.providerId} (opens in a new tab)</span
							>
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			</div>
		{/if}

		<ul class="space-y-2">
			{#each rows as row (row.quote.providerId)}
				<li>
					<ProviderPriceRow
						quote={row.quote}
						provider={row.provider}
						best={row.best}
						class="w-full"
					/>
				</li>
			{/each}
		</ul>

		<p class="text-xs text-subtle-foreground">
			Each price is that marketplace's lowest current ask for this variant, in {currency}.
		</p>
	{/if}
</section>
