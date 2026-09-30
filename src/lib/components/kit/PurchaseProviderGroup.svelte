<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import ProviderLogo from '$lib/components/market/ProviderLogo.svelte';
	import PriceDisplay from '$lib/components/market/PriceDisplay.svelte';
	import { formatMoney } from '$lib/formatters/currency';
	import type { PurchaseProviderGroup } from '$lib/features/kits/purchase-strategy';
	import type { MarketProvider } from '$lib/types/provider';

	/**
	 * Everything a plan buys from one marketplace.
	 *
	 * This is the shape of the actual errand: go here, buy these, that is what
	 * it comes to. The subtotal sums **only** the items assigned to this
	 * marketplace — it is never a share of the kit total.
	 *
	 * Each offer links out through the quote's own tracked redirect. No link is
	 * invented: a quote that arrives without one (batch responses carry no
	 * redirect) simply shows the price, and there is no "open all" — five tabs
	 * a visitor did not ask for is not a feature.
	 */
	let {
		group,
		providers = []
	}: { group: PurchaseProviderGroup; providers?: readonly MarketProvider[] } = $props();

	const provider = $derived(providers.find((entry) => entry.id === group.providerId));
	const name = $derived(provider?.name ?? group.providerId);
</script>

<section class="rounded-lg border border-border bg-surface" aria-label="Buy from {name}">
	<header class="flex items-center gap-2 border-b border-border px-3 py-2">
		{#if provider}
			<ProviderLogo {provider} decorative />
		{/if}
		<h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{name}</h3>
		<span class="shrink-0 text-xs text-subtle-foreground">
			{group.lines.length}
			{group.lines.length === 1 ? 'skin' : 'skins'}
		</span>
	</header>

	<ul class="divide-y divide-border">
		{#each group.lines as line (line.quote.itemId)}
			<li class="flex items-center gap-3 px-3 py-2">
				<span class="min-w-0 flex-1">
					<span class="block truncate text-xs text-muted-foreground">
						{line.priced.item.skin.weapon}
					</span>
					<span class="block truncate text-sm text-foreground">
						{line.priced.item.skin.name}
					</span>
					{#if line.priced.item.variant.wear}
						<span class="block truncate text-xs text-subtle-foreground">
							{line.priced.item.variant.wear}
						</span>
					{/if}
				</span>

				<PriceDisplay
					amountMinor={line.quote.priceMinor}
					currency={line.quote.currency}
					size="sm"
					class="shrink-0 items-end"
				/>

				{#if line.quote.redirectUrl}
					<!--
						A marketplace redirect owned by CS2Cap, not one of our
						routes, so `resolve()` does not apply — it would corrupt
						the URL.
					-->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={line.quote.redirectUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
					>
						View offer
						<span class="sr-only">
							for {line.priced.item.skin.fullName} on {name} (opens in a new tab)
						</span>
						<ExternalLinkIcon class="size-3" aria-hidden="true" />
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</li>
		{/each}
	</ul>

	<footer
		class="flex items-baseline justify-between gap-3 border-t border-border px-3 py-2 text-sm"
	>
		<span class="text-muted-foreground">Subtotal</span>
		<span class="font-mono font-medium text-foreground tabular-nums">
			{formatMoney(group.subtotalMinor, group.lines[0]?.quote.currency ?? 'BRL')}
		</span>
	</footer>
</section>
