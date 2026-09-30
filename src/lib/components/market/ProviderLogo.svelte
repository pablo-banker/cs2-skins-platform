<script lang="ts">
	import { cn } from '$lib/utils';
	import type { MarketProvider } from '$lib/types/provider';

	/**
	 * A marketplace's logo at a fixed size.
	 *
	 * The box never changes size, logo or not, so a list of providers stays
	 * aligned whether or not every image resolves. Nothing about which
	 * marketplaces exist is hardcoded here — the provider comes from upstream.
	 */
	let {
		provider,
		/** Set when the provider's name is already rendered beside the logo. */
		decorative = false,
		class: className
	}: { provider: MarketProvider; decorative?: boolean; class?: string } = $props();

	let failed = $state(false);

	$effect(() => {
		void provider.logoUrl;
		failed = false;
	});

	const showFallback = $derived(!provider.logoUrl || failed);
	const initial = $derived(provider.name.trim().charAt(0).toUpperCase());
</script>

<span
	class={cn(
		'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-elevated',
		className
	)}
>
	{#if showFallback}
		<!-- No invented logo: the initial is honest and keeps the row aligned. -->
		<span class="text-xs font-medium text-muted-foreground" aria-hidden="true">{initial}</span>
		{#if !decorative}
			<span class="sr-only">{provider.name}</span>
		{/if}
	{:else}
		<img
			src={provider.logoUrl}
			alt={decorative ? '' : provider.name}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
			class="size-full object-contain p-0.5"
		/>
	{/if}
</span>
